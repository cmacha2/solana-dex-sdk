// Exportaciones principales
export { SolanaDexClient } from './SolanaDexClient';

export { SwapConfig } from './types';
export { TokenPrice } from './types';

export * from './utils';


if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SolanaDexClient: require('./SolanaDexClient').SolanaDexClient,
    SwapConfig: require('./types').SwapConfig,
    TokenPrice: require('./types').TokenPrice,
    ...require('./utils'),  
  };
}
