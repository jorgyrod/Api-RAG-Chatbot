FROM node:22-slim

WORKDIR /app

RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev \
    && rm -rf node_modules/onnxruntime-node/bin/napi-v3/darwin \
              node_modules/onnxruntime-node/bin/napi-v3/win32 \
              node_modules/onnxruntime-node/bin/napi-v3/linux/arm64 \
              node_modules/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime_providers_cuda.so \
              node_modules/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime_providers_tensorrt.so \
    && npm cache clean --force

COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node src ./src

COPY --chown=node:node models/ node_modules/@huggingface/transformers/.cache/
COPY --chown=node:node data/ /app/data/
COPY --chown=node:node storage/ /app/storage/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]

