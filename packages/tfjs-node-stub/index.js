// Stub for @tensorflow/tfjs-node that redirects to CPU backend
// This allows @vladmandic/face-api to work on ARM64 where native bindings fail

import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';

// Ensure CPU backend is set
tf.setBackend('cpu').then(() => tf.ready()).catch(() => {
  // Ignore errors during backend setup
});

// Export everything from tfjs-core
export default tf;
export * from '@tensorflow/tfjs-core';
