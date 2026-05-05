"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createImage = createImage;
/** Factory — единственный правильный способ создавать ProductImage */
function createImage(url, options = {}) {
    return {
        url,
        isMain: options.isMain ?? false,
        sortOrder: options.sortOrder ?? 0,
        context: options.context ?? 'product',
    };
}
