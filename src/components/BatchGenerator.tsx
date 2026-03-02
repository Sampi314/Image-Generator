import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Image as ImageIcon, Play, AlertCircle, X, Download, Github, Maximize2, Archive } from 'lucide-react';
import { enhancePrompt, generateImage } from '../services/geminiService';
import { GithubImportModal } from './GithubImportModal';
import { ImageModal } from './ImageModal';
import JSZip from 'jszip';

export type PromptItemType = {
  id: string;
  title: string;
  originalPrompt: string;
  enhancedPrompt: string;
  referenceImages: { id: string; data: string; mimeType: string; url: string }[];
  status: 'idle' | 'enhancing' | 'generating' | 'success' | 'error';
  resultImageUrl?: string;
  error?: string;
  isExpanded: boolean;
};

export type StoredImage = {
  id: string;
  title: string;
  prompt: string;
  imageUrl: string;
  createdAt: number;
};

const SUGGESTED_STYLES = [
  'Cinematic', 'Photorealistic', 'Anime', 'Watercolor',
  'Cyberpunk', 'Oil Painting', '3D Render', 'Pencil Sketch',
  'Studio Lighting', 'Vintage', 'Neon Noir', 'Fantasy Art'
];

export function BatchGenerator() {
  const [items, setItems] = useState<PromptItemType[]>([
    {
      id: crypto.randomUUID(),
      title: 'Prompt 1',
      originalPrompt: '',
      enhancedPrompt: '',
      referenceImages: [],
      status: 'idle',
      isExpanded: true,
    }
  ]);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false);
  const [globalSelectedStyles, setGlobalSelectedStyles] = useState<string[]>([]);
  const [isGlobalStylesExpanded, setIsGlobalStylesExpanded] = useState(true);
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);
  const [storedImages, setStoredImages] = useState<StoredImage[]>([]);
  const [activeTab, setActiveTab] = useState<'batch' | 'storage'>('batch');
  const [availableStyles, setAvailableStyles] = useState<string[]>(SUGGESTED_STYLES);
  const [newStyleInput, setNewStyleInput] = useState('');

  const handleAddStyle = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newStyleInput.trim();
    if (trimmed && !availableStyles.includes(trimmed)) {
      setAvailableStyles(prev => [...prev, trimmed]);
      setGlobalSelectedStyles(prev => [...prev, trimmed]);
      setNewStyleInput('');
      // Clear enhanced prompts so they regenerate with new styles
      setItems(prev => prev.map(item => ({ ...item, enhancedPrompt: '' })));
    }
  };

  const removeStyle = (e: React.MouseEvent, styleToRemove: string) => {
    e.stopPropagation();
    setAvailableStyles(prev => prev.filter(s => s !== styleToRemove));
    setGlobalSelectedStyles(prev => prev.filter(s => s !== styleToRemove));
    // Clear enhanced prompts so they regenerate with new styles
    setItems(prev => prev.map(item => ({ ...item, enhancedPrompt: '' })));
  };

  const addItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: `Prompt ${prev.length + 1}`,
        originalPrompt: '',
        enhancedPrompt: '',
        referenceImages: [],
        status: 'idle',
        isExpanded: true,
      }
    ]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<PromptItemType>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const toggleExpand = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, isExpanded: !item.isExpanded } : item));
  };

  const toggleStyle = (style: string) => {
    setGlobalSelectedStyles(prev => {
      const newStyles = prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style];
      return newStyles;
    });
    // Clear enhanced prompts so they regenerate with new styles
    setItems(prev => prev.map(item => ({ ...item, enhancedPrompt: '' })));
  };

  const handleImageUpload = (id: string, files: FileList | null) => {
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const [mimePrefix, base64Data] = dataUrl.split(',');
        const mimeType = mimePrefix.split(':')[1].split(';')[0];
        
        setItems(prev => prev.map(item => {
          if (item.id === id) {
            return {
              ...item,
              referenceImages: [
                ...item.referenceImages,
                { id: crypto.randomUUID(), data: base64Data, mimeType, url: dataUrl }
              ]
            };
          }
          return item;
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeReferenceImage = (itemId: string, imageId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          referenceImages: item.referenceImages.filter(img => img.id !== imageId)
        };
      }
      return item;
    }));
  };

  const processItem = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    if (!item.originalPrompt.trim()) {
      updateItem(id, { error: 'Prompt cannot be empty', status: 'error' });
      return;
    }

    try {
      const combinedPrompt = `${item.originalPrompt}${globalSelectedStyles.length ? `\n\nStyles: ${globalSelectedStyles.join(', ')}` : ''}`;
      
      let finalPrompt = item.enhancedPrompt;
      
      if (!finalPrompt || item.status === 'error') {
        updateItem(id, { status: 'enhancing', error: undefined });
        finalPrompt = await enhancePrompt(combinedPrompt);
        updateItem(id, { enhancedPrompt: finalPrompt });
      }

      updateItem(id, { status: 'generating', error: undefined });
      const imageUrl = await generateImage(finalPrompt, item.referenceImages);
      
      updateItem(id, { 
        status: 'success', 
        resultImageUrl: imageUrl,
      });

      setStoredImages(prev => [{
        id: crypto.randomUUID(),
        title: item.title,
        prompt: finalPrompt,
        imageUrl: imageUrl,
        createdAt: Date.now()
      }, ...prev]);
    } catch (error: any) {
      console.error(error);
      updateItem(id, { 
        status: 'error', 
        error: error.message || 'Failed to generate image' 
      });
    }
  };

  const handleBatchGenerate = async () => {
    setIsBatchGenerating(true);
    
    const promises = items
      .filter(item => item.status === 'idle' || item.status === 'error' || (!item.resultImageUrl && item.status !== 'success'))
      .map(item => processItem(item.id));
      
    await Promise.all(promises);
    
    setIsBatchGenerating(false);
  };

  const downloadImage = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const folder = zip.folder("generated_images");
    
    if (!folder) return;

    const promises = items
      .filter(item => item.resultImageUrl)
      .map(async (item) => {
        if (!item.resultImageUrl) return;
        
        // Convert base64 to blob
        const response = await fetch(item.resultImageUrl);
        const blob = await response.blob();
        
        const filename = `${item.title || 'generated'}.png`;
        folder.file(filename, blob);
      });

    await Promise.all(promises);
    
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = "batch_images.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGithubImport = (importedFiles: {title: string, content: string}[]) => {
    const newItems: PromptItemType[] = importedFiles.map((file) => ({
      id: crypto.randomUUID(),
      title: file.title,
      originalPrompt: file.content,
      enhancedPrompt: '',
      referenceImages: [],
      status: 'idle',
      isExpanded: false,
    }));
    
    setItems(prev => {
      // If the only item is the default empty one, replace it
      if (prev.length === 1 && !prev[0].originalPrompt && prev[0].title === 'Prompt 1') {
        return newItems;
      }
      return [...prev, ...newItems];
    });
  };

  const removeResultImage = (id: string) => {
    updateItem(id, { resultImageUrl: undefined, status: 'idle' });
  };

  const hasAnyResult = items.some(item => !!item.resultImageUrl);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      
      {/* Left Panel: Prompts */}
      <div className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-950/50 z-20 shadow-xl">
        <div className="p-5 border-b border-zinc-800 flex flex-col gap-5 bg-zinc-950">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Batch Generator</h1>
            <p className="text-sm text-zinc-400 mt-1">Gemini 3.1 Pro & Flash Image</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsGithubModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors border border-zinc-700"
              title="Import from GitHub"
            >
              <Github className="w-4 h-4" /> Import
            </button>
            <button
              onClick={addItem}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors border border-zinc-700"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
            <button
              onClick={handleBatchGenerate}
              disabled={isBatchGenerating || items.length === 0}
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
            >
              {isBatchGenerating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              Batch Generate
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* Global Anchors Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-sm mb-6 overflow-hidden">
            <div 
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
              onClick={() => setIsGlobalStylesExpanded(!isGlobalStylesExpanded)}
            >
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Global Style Anchors
              </h3>
              <div className="text-zinc-500">
                {isGlobalStylesExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
            
            {isGlobalStylesExpanded && (
              <div className="p-5 border-t border-zinc-800 space-y-5">
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-2 block uppercase tracking-wider">Text Style Anchors</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {availableStyles.map(style => {
                      const isSelected = globalSelectedStyles.includes(style);
                      return (
                        <button
                          key={style}
                          onClick={() => toggleStyle(style)}
                          className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            isSelected 
                              ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-sm shadow-blue-500/10' 
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                          }`}
                        >
                          <span>{style}</span>
                          <div 
                            onClick={(e) => removeStyle(e, style)}
                            className={`p-0.5 rounded-full transition-colors ${isSelected ? 'hover:bg-blue-500/30 text-blue-400' : 'hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
                          >
                            <X className="w-3 h-3" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <form onSubmit={handleAddStyle} className="flex gap-2">
                    <input
                      type="text"
                      value={newStyleInput}
                      onChange={e => setNewStyleInput(e.target.value)}
                      placeholder="Add custom style (e.g. '8-bit', 'Origami')..."
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!newStyleInput.trim()}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors border border-zinc-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {items.map((item, index) => (
            <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-zinc-700">
              <div 
                className="p-4 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-800/20 cursor-pointer"
                onClick={() => toggleExpand(item.id)}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-zinc-400 text-xs font-mono shrink-0">
                    {index + 1}
                  </div>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateItem(item.id, { title: e.target.value })}
                    onClick={e => e.stopPropagation()}
                    className="bg-transparent border-none focus:ring-0 text-base font-medium text-white placeholder-zinc-500 w-full"
                    placeholder="Prompt Title"
                  />
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} 
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="p-1 text-zinc-500">
                    {item.isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>
              
              {item.isExpanded && (
                <div className="p-4 space-y-5">
                  <div>
                    <label className="text-xs font-medium text-zinc-400 mb-2 block uppercase tracking-wider">Base Prompt</label>
                    <textarea
                      value={item.originalPrompt}
                      onChange={(e) => updateItem(item.id, { originalPrompt: e.target.value, enhancedPrompt: '' })}
                      placeholder="Describe your image..."
                      className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400 mb-2 block uppercase tracking-wider">Image Anchors</label>
                    <div className="flex flex-wrap gap-3">
                      {item.referenceImages.map(img => (
                        <div key={img.id} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-zinc-700 shadow-sm">
                          <img src={img.url} alt="Ref" className="w-full h-full object-cover" />
                          <button 
                            onClick={() => removeReferenceImage(item.id, img.id)} 
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ))}
                      <label className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50 rounded-xl cursor-pointer transition-colors text-zinc-500 hover:text-zinc-300">
                        <Plus className="w-5 h-5 mb-0.5" />
                        <span className="text-[9px] font-medium uppercase tracking-wider">Upload</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleImageUpload(item.id, e.target.files)} />
                      </label>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => processItem(item.id)}
                      disabled={item.status === 'enhancing' || item.status === 'generating'}
                      className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors border border-zinc-700 flex items-center justify-center gap-2 shadow-sm"
                    >
                      {item.status === 'enhancing' || item.status === 'generating' ? (
                        <div className="w-4 h-4 border-2 border-zinc-400 border-t-white rounded-full animate-spin" />
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                      Generate Image
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {items.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-2xl">
              <p className="text-zinc-500 text-sm">Click "Add" to create a prompt.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Results */}
      <div className="flex-1 flex flex-col bg-zinc-950 relative overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md z-10 sticky top-0">
          <div className="flex gap-6">
            <button 
              onClick={() => setActiveTab('batch')}
              className={`text-lg font-medium transition-colors relative ${activeTab === 'batch' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Current Batch
              {activeTab === 'batch' && <div className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-blue-500" />}
            </button>
            <button 
              onClick={() => setActiveTab('storage')}
              className={`text-lg font-medium transition-colors relative flex items-center gap-2 ${activeTab === 'storage' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Storage
              <span className="bg-zinc-800 text-zinc-300 text-[10px] px-2 py-0.5 rounded-full">{storedImages.length}</span>
              {activeTab === 'storage' && <div className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-blue-500" />}
            </button>
          </div>
          {activeTab === 'batch' && (
            <button 
              onClick={handleDownloadAll} 
              disabled={!hasAnyResult} 
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors border border-zinc-700 shadow-sm"
            >
              <Download className="w-4 h-4" /> Download All (Zip)
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'batch' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden shadow-lg">
                  <div className="p-4 border-b border-zinc-800/50 bg-zinc-900/80">
                    <h3 className="text-base font-bold text-white truncate" title={item.title}>{item.title}</h3>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2" title={item.enhancedPrompt || item.originalPrompt}>
                      {item.enhancedPrompt || item.originalPrompt || 'No prompt provided yet.'}
                    </p>
                  </div>
                  
                  <div className="relative group aspect-square bg-zinc-950 flex-1">
                    {item.resultImageUrl ? (
                      <>
                        <img 
                          src={item.resultImageUrl} 
                          alt={item.title} 
                          className="w-full h-full object-cover cursor-zoom-in" 
                          onClick={() => setSelectedImage({ url: item.resultImageUrl!, title: item.title })}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-sm pointer-events-none">
                          <div className="pointer-events-auto flex flex-col gap-3">
                            <button 
                              onClick={() => setSelectedImage({ url: item.resultImageUrl!, title: item.title })}
                              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-transform hover:scale-105 backdrop-blur-md border border-white/10"
                            >
                              <Maximize2 className="w-4 h-4" /> View
                            </button>
                            <button 
                              onClick={() => downloadImage(item.resultImageUrl!, `${item.title}.png`)} 
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-transform hover:scale-105 shadow-lg shadow-blue-900/50"
                            >
                              <Download className="w-4 h-4" /> Download
                            </button>
                            <button 
                              onClick={() => removeResultImage(item.id)} 
                              className="flex items-center gap-2 px-4 py-2 bg-red-600/90 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-transform hover:scale-105 shadow-lg shadow-red-900/50"
                            >
                              <Trash2 className="w-4 h-4" /> Remove
                            </button>
                          </div>
                        </div>
                      </>
                    ) : item.status === 'enhancing' || item.status === 'generating' ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400">
                        <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-3" />
                        <p className="text-sm font-medium">{item.status === 'enhancing' ? 'Enhancing...' : 'Generating...'}</p>
                      </div>
                    ) : item.status === 'error' ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-4 text-center bg-red-950/10">
                        <AlertCircle className="w-8 h-8 mb-3 opacity-50" />
                        <p className="text-xs font-medium line-clamp-3">{item.error}</p>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
                        <ImageIcon className="w-8 h-8 mb-3 opacity-20" />
                        <p className="text-sm font-medium">Not generated</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {items.length === 0 && (
                <div className="col-span-full text-center py-32">
                  <ImageIcon className="w-16 h-16 mx-auto text-zinc-700 mb-6" />
                  <h3 className="text-2xl font-medium text-zinc-400 mb-2">No images to display</h3>
                  <p className="text-zinc-600">Add a prompt on the left panel to get started.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
              {storedImages.map((stored) => (
                <div key={stored.id} className="flex flex-col bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden shadow-lg">
                  <div className="p-4 border-b border-zinc-800/50 bg-zinc-900/80">
                    <h3 className="text-base font-bold text-white truncate" title={stored.title}>{stored.title}</h3>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2" title={stored.prompt}>
                      {stored.prompt}
                    </p>
                  </div>
                  
                  <div className="relative group aspect-square bg-zinc-950 flex-1">
                    <img 
                      src={stored.imageUrl} 
                      alt={stored.title} 
                      className="w-full h-full object-cover cursor-zoom-in" 
                      onClick={() => setSelectedImage({ url: stored.imageUrl, title: stored.title })}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-sm pointer-events-none">
                      <div className="pointer-events-auto flex flex-col gap-3">
                        <button 
                          onClick={() => setSelectedImage({ url: stored.imageUrl, title: stored.title })}
                          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-transform hover:scale-105 backdrop-blur-md border border-white/10"
                        >
                          <Maximize2 className="w-4 h-4" /> View
                        </button>
                        <button 
                          onClick={() => downloadImage(stored.imageUrl, `${stored.title}.png`)} 
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-transform hover:scale-105 shadow-lg shadow-blue-900/50"
                        >
                          <Download className="w-4 h-4" /> Download
                        </button>
                        <button 
                          onClick={() => setStoredImages(prev => prev.filter(i => i.id !== stored.id))} 
                          className="flex items-center gap-2 px-4 py-2 bg-red-600/90 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-transform hover:scale-105 shadow-lg shadow-red-900/50"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {storedImages.length === 0 && (
                <div className="col-span-full text-center py-32">
                  <Archive className="w-16 h-16 mx-auto text-zinc-700 mb-6" />
                  <h3 className="text-2xl font-medium text-zinc-400 mb-2">Storage is empty</h3>
                  <p className="text-zinc-600">Successfully generated images will be automatically saved here.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #3f3f46;
          border-radius: 20px;
        }
      `}</style>

      <GithubImportModal 
        isOpen={isGithubModalOpen} 
        onClose={() => setIsGithubModalOpen(false)} 
        onImport={handleGithubImport} 
      />
      
      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage.url}
          title={selectedImage.title}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}
