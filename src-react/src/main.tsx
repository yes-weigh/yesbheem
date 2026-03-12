import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import './index.css';
import { FlowCanvas } from './components/flow/FlowCanvas';

let reactRoot: Root | null = null;

const initFlowBuilder = (props: any = {}) => {
  const rootElement = document.getElementById('react-flow-builder-root');
  if (rootElement) {
    if (reactRoot) {
        reactRoot.render(
            <React.StrictMode>
                <FlowCanvas {...props} />
            </React.StrictMode>
        );
    } else {
        reactRoot = createRoot(rootElement);
        reactRoot.render(
            <React.StrictMode>
                <FlowCanvas {...props} />
            </React.StrictMode>
        );
    }
  } else {
      console.error("Root element 'react-flow-builder-root' not found.");
  }
};

const unmountFlowBuilder = () => {
    if (reactRoot) {
        reactRoot.unmount();
        reactRoot = null;
    }
};

(window as any).mountReactFlowBuilder = initFlowBuilder;
(window as any).unmountReactFlowBuilder = unmountFlowBuilder;
