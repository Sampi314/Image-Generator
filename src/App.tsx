/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApiKeyGate } from './components/ApiKeyGate';
import { BatchGenerator } from './components/BatchGenerator';

export default function App() {
  return (
    <ApiKeyGate>
      <BatchGenerator />
    </ApiKeyGate>
  );
}
