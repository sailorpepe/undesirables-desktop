'use client';
/**
 * useNFTFetch.js — Fetch NFT metadata from Ethereum mainnet
 * 
 * Strategy:
 * 1. Try Alchemy getNFTMetadata API if user has a saved key
 * 2. Fall back to raw tokenURI() call via public RPC
 * 3. Handle IPFS URLs, base64-encoded data URIs, and standard HTTPS
 * 
 * No WalletConnect — read-only RPC calls only.
 */
import { useState, useCallback } from 'react';

const PUBLIC_RPC = 'https://eth.public-rpc.com';
const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

// ERC-721 tokenURI(uint256) function selector
const TOKEN_URI_SELECTOR = '0xc87b56dd';

/**
 * Convert an IPFS URL to an HTTP gateway URL
 */
function resolveIPFS(url) {
  if (!url) return url;
  if (url.startsWith('ipfs://')) {
    return IPFS_GATEWAY + url.slice(7);
  }
  if (url.startsWith('ar://')) {
    return 'https://arweave.net/' + url.slice(5);
  }
  return url;
}

/**
 * Pad a uint256 token ID to 64 hex chars for ABI encoding
 */
function encodeTokenId(tokenId) {
  const hex = BigInt(tokenId).toString(16);
  return hex.padStart(64, '0');
}

/**
 * Decode a hex string response from eth_call into a UTF-8 string
 */
function decodeStringResponse(hex) {
  if (!hex || hex === '0x') return null;
  // Remove 0x prefix
  const data = hex.slice(2);
  // ABI-encoded string: offset (32 bytes) + length (32 bytes) + data
  if (data.length < 128) return null;
  
  const lengthHex = data.slice(64, 128);
  const strLength = parseInt(lengthHex, 16);
  
  if (strLength === 0 || strLength > 10000) return null;
  
  const strHex = data.slice(128, 128 + strLength * 2);
  
  // Convert hex to UTF-8
  const bytes = new Uint8Array(strLength);
  for (let i = 0; i < strLength; i++) {
    bytes[i] = parseInt(strHex.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

export default function useNFTFetch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [nftName, setNftName] = useState(null);

  const fetchNFT = useCallback(async (contractAddress, tokenId, chain = 'ethereum') => {
    setLoading(true);
    setError(null);
    setMetadata(null);
    setImageUrl(null);
    setNftName(null);

    try {
      // Validate inputs
      if (!contractAddress || !contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('Invalid contract address. Must be 0x followed by 40 hex characters.');
      }
      if (!tokenId && tokenId !== 0) {
        throw new Error('Token ID is required.');
      }

      let meta = null;

      // Strategy 1: Try Alchemy API if key is available
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('credentials.json', { autoSave: false });
        const alchemyKey = await store.get('undesirables_alchemy_key');

        if (alchemyKey && alchemyKey.length > 20) {
          const alchemyUrl = `https://eth-mainnet.g.alchemy.com/nft/v3/${alchemyKey}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}&refreshCache=false`;
          const res = await fetch(alchemyUrl);

          if (res.ok) {
            const data = await res.json();
            meta = {
              name: data.name || data.title || `#${tokenId}`,
              description: data.description || '',
              image: data.image?.cachedUrl || data.image?.originalUrl || data.raw?.metadata?.image || null,
              attributes: data.raw?.metadata?.attributes || [],
              collection: data.contract?.name || '',
            };
          }
        }
      } catch (e) {
        console.warn('[useNFTFetch] Alchemy attempt failed, falling back to public RPC:', e.message);
      }

      // Strategy 2: Public RPC tokenURI call
      if (!meta) {
        const callData = TOKEN_URI_SELECTOR + encodeTokenId(tokenId);

        const rpcRes = await fetch(PUBLIC_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{ to: contractAddress, data: callData }, 'latest'],
            id: 1,
          }),
        });

        const rpcData = await rpcRes.json();

        if (rpcData.error) {
          throw new Error(`RPC Error: ${rpcData.error.message || 'Contract call failed'}`);
        }

        const tokenURI = decodeStringResponse(rpcData.result);
        if (!tokenURI) {
          throw new Error('Could not decode tokenURI from contract. The contract may not implement ERC-721.');
        }

        // Fetch metadata from tokenURI
        let metadataJson;
        if (tokenURI.startsWith('data:application/json;base64,')) {
          const b64 = tokenURI.split(',')[1];
          metadataJson = JSON.parse(atob(b64));
        } else if (tokenURI.startsWith('data:application/json')) {
          // URL-encoded JSON
          const jsonStr = decodeURIComponent(tokenURI.split(',')[1]);
          metadataJson = JSON.parse(jsonStr);
        } else {
          const resolvedURI = resolveIPFS(tokenURI);
          const metaRes = await fetch(resolvedURI);
          if (!metaRes.ok) throw new Error(`Failed to fetch metadata from ${resolvedURI}`);
          metadataJson = await metaRes.json();
        }

        meta = {
          name: metadataJson.name || `#${tokenId}`,
          description: metadataJson.description || '',
          image: metadataJson.image || metadataJson.image_url || null,
          attributes: metadataJson.attributes || [],
          collection: '',
        };
      }

      // Resolve the image URL
      if (meta.image) {
        meta.image = resolveIPFS(meta.image);
      }

      if (!meta.image) {
        throw new Error('NFT metadata found but no image field present.');
      }

      setMetadata(meta);
      setImageUrl(meta.image);
      setNftName(meta.name);
      setLoading(false);

      return { metadata: meta, imageUrl: meta.image, name: meta.name };
    } catch (err) {
      console.error('[useNFTFetch] Error:', err);
      setError(err.message);
      setLoading(false);
      return { error: err.message };
    }
  }, []);

  const reset = useCallback(() => {
    setMetadata(null);
    setImageUrl(null);
    setNftName(null);
    setError(null);
  }, []);

  return { fetchNFT, reset, loading, error, metadata, imageUrl, nftName };
}
