import React, { useState } from 'react';
import { Github, X, Download, Loader2 } from 'lucide-react';

export function GithubImportModal({ 
  isOpen, 
  onClose, 
  onImport 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onImport: (files: {title: string, content: string}[]) => void 
}) {
  const [url, setUrl] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('');
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUrlPaste = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pastedUrl = e.target.value;
    setUrl(pastedUrl);
    
    try {
      const urlObj = new URL(pastedUrl);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length >= 5 && parts[2] === 'tree') {
        setOwner(parts[0]);
        setRepo(parts[1]);
        
        let branchName = parts[3];
        let pathIndex = 4;
        // Handle common branch names that might contain slashes
        if (parts.length > 5 && ['feature', 'bugfix', 'hotfix', 'release'].includes(parts[3])) {
           branchName = parts[3] + '/' + parts[4];
           pathIndex = 5;
        }
        setBranch(branchName);
        setPath(decodeURIComponent(parts.slice(pathIndex).join('/')));
      }
    } catch (err) {
      // Ignore parse errors
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setError('');
    try {
      // We need to encode the path components properly but keep the slashes
      const encodedPath = path.split('/').map(p => encodeURIComponent(p)).join('/');
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${branch}`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.statusText} (${response.status})`);
      }
      
      const files = await response.json();
      if (!Array.isArray(files)) {
        throw new Error("Path is not a directory");
      }
      
      const mdFiles = files.filter((f: any) => f.name.endsWith('.md') && f.type === 'file');
      
      if (mdFiles.length === 0) {
        throw new Error("No .md files found in this directory");
      }
      
      const results = [];
      for (const file of mdFiles) {
        const fileRes = await fetch(file.download_url);
        if (fileRes.ok) {
          const content = await fileRes.text();
          results.push({
            title: file.name.replace(/\.md$/, ''),
            content: content
          });
        }
      }
      
      onImport(results);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to import files");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Github className="w-5 h-5" /> Import from GitHub
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1 block uppercase tracking-wider">GitHub Folder URL</label>
            <input
              type="text"
              value={url}
              onChange={handleUrlPaste}
              placeholder="https://github.com/owner/repo/tree/branch/path"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1 block uppercase tracking-wider">Owner</label>
              <input type="text" value={owner} onChange={e => setOwner(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-sm text-zinc-100" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1 block uppercase tracking-wider">Repo</label>
              <input type="text" value={repo} onChange={e => setRepo(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-sm text-zinc-100" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1 block uppercase tracking-wider">Branch</label>
              <input type="text" value={branch} onChange={e => setBranch(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-sm text-zinc-100" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1 block uppercase tracking-wider">Path</label>
              <input type="text" value={path} onChange={e => setPath(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-sm text-zinc-100" />
            </div>
          </div>
          
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          
          <button
            onClick={handleImport}
            disabled={loading || !owner || !repo || !branch || !path}
            className="w-full py-3 bg-white hover:bg-zinc-200 text-black rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {loading ? 'Importing...' : 'Import .md Files'}
          </button>
        </div>
      </div>
    </div>
  );
}
