"use client";
import React, { useState } from 'react';

export default function LegalGateway({ onAccept }) {
  const [checked, setChecked] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    // Allow a 5px margin of error for DPI calculation rounding
    if (scrollHeight - scrollTop <= clientHeight + 5) {
      setScrolledToBottom(true);
    }
  };

  const handleLocalAccept = () => {
    // Write an immortal timestamped signature to local disk
    localStorage.setItem('undesirables_legal_consent', `v1.0.0_${Date.now()}`);
    onAccept();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#05240c] z-50 p-4">
      <div className="max-w-2xl w-full border border-[#39ff14]/30 bg-[#081a0c] p-8 rounded-lg shadow-[0_0_30px_rgba(57,255,20,0.1)] relative overflow-hidden">
        {/* Animated Cyber Edge */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#39ff14] to-transparent"></div>
        
        <h2 className="text-3xl font-bold text-white mb-2 font-mono uppercase tracking-wider flex items-center gap-3">
          <span className="text-[#39ff14]">///</span> SYSTEM WARNING
        </h2>
        <p className="text-sm text-[#e0faec]/70 mb-6 font-mono">LIABILITY_WAIVER_V1.0</p>
        
        <div 
          onScroll={handleScroll}
          className="bg-black/50 border border-[#39ff14]/20 p-4 rounded font-mono text-sm space-y-4 text-[#e0faec]/80 mb-8 max-h-[300px] overflow-y-auto"
        >
          <p>
            <strong className="text-[#ff00ff]">1. THE OS-LEVEL EXECUTION WAIVER (ASSUMPTION OF RISK)</strong><br/>
            The Undesirables Application executes arbitrary code locally on your machine. You acknowledge that AI-driven Agentic actions or third-party Model Context Protocol (MCP) servers require direct read/write access to your local file system and operating system environment. You expressly assume all risks associated with local code execution. The Undesirables LLC specifically disclaims all liability for, and you release the LLC from, any data loss, system corruption, hardware damage, or malicious sandbox escapes resulting from these localized processes.
          </p>
          <p>
            <strong className="text-[#39ff14]">2. ENTERTAINMENT & EDUCATIONAL PURPOSES ONLY (NFA)</strong><br/>
            The AI operates purely as a fictional character designed strictly for entertainment and educational purposes. AI models hallucinate and act non-deterministically. The Undesirables LLC makes no representations, warranties, or guarantees regarding the accuracy, safety, or validity of code executed, smart contract interactions, or Web3 transactions suggested by the model. This software DOES NOT provide financial, investment, or legal advice. <span className="text-white bg-[#ff00ff]/20 px-1 rounded">DO NOT TRADE OFF ITS ADVICE.</span> You are solely responsible for manually reviewing and independently verifying all RPC payloads before executing them securely via your hardware or software wallets.
          </p>
          <p>
            <strong className="text-[#ff00ff]">3. NON-CUSTODIAL & FIDUCIARY DISCLAIMER</strong><br/>
            This software operates strictly as a local interface. It is not a custodial wallet, exchange, or financial advisor. The Undesirables LLC DOES NOT possess, manage, or have access to your private keys, seed phrases, or digital assets. Under no circumstances shall The Undesirables LLC be liable for the loss of NFTs, cryptocurrency, or compromised private keys resulting from user error, local environment compromises, phishing, or malicious AI prompt injections.
          </p>
          <p>
            <strong className="text-[#39ff14]">4. AS-IS OSS LIMITATION</strong><br/>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS, COPYRIGHT HOLDERS, OR THE UNDESIRABLES LLC BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
          </p>
          <p>
            <strong className="text-[#ff00ff]">5. GOVERNING LAW, ARBITRATION, & CLASS ACTION WAIVER</strong><br/>
            These Terms shall be governed by the laws of the State of Delaware, without regard to conflict of law principles. Any dispute, claim, or controversy arising out of or relating to this software shall be resolved exclusively through binding, individual arbitration. YOU EXPRESSLY WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION AGAINST THE UNDESIRABLES LLC. If any provision of these terms is found to be unenforceable, the remainder shall remain in full force and effect.
          </p>
        </div>

        <label className={`flex items-start gap-4 mb-8 group pl-2 transition-all ${scrolledToBottom ? 'cursor-pointer' : 'cursor-not-allowed opacity-50 grayscale'}`}>
          <input 
            type="checkbox" 
            checked={checked} 
            onChange={(e) => setChecked(e.target.checked)}
            disabled={!scrolledToBottom}
            className="mt-1 w-5 h-5 accent-[#39ff14] bg-black border-[#39ff14]/50 rounded cursor-pointer disabled:cursor-not-allowed"
          />
          <span className="text-[#e0faec] text-sm leading-relaxed select-none group-hover:text-[#39ff14] transition-colors duration-200">
            {scrolledToBottom ? 'I have read and unconditionally agree to the local proxy Terms of Service.' : 'Must scroll all the way to the bottom to unlock this agreement.'}
          </span>
        </label>


        <div className="flex justify-between items-center gap-4">
            <span className="text-xs text-[#e0faec]/30 font-mono tracking-widest hidden sm:block">LOCAL_EXECUTION_ONLY</span>
          <div className="flex gap-4">
            <a href="https://the-undesirables.com" className="px-6 py-3 text-sm font-bold text-[#e0faec]/50 hover:text-white transition-colors font-mono uppercase flex items-center">
              Abort
            </a>
            <button 
              onClick={handleLocalAccept}
              disabled={!checked || !scrolledToBottom}
              className={`px-8 py-3 rounded font-bold uppercase tracking-widest transition-all duration-300 font-mono flex items-center gap-2
                ${checked 
                  ? 'bg-[#39ff14] text-black shadow-[0_0_20px_rgba(57,255,20,0.4)] hover:bg-[#2fe010] hover:scale-[1.02]' 
                  : 'bg-[#39ff14]/10 text-[#39ff14]/30 cursor-not-allowed border border-[#39ff14]/20'
                }`}
            >
              I Accept <span className={checked ? 'opacity-100' : 'opacity-0'}>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
