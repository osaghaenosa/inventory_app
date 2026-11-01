import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api.js';
import {
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  CheckCircle2,
  AlertTriangle,
  Send,
  Code2,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Package,
  ShoppingCart,
  Phone,
  MapPin,
  Clock,
  RotateCcw
} from 'lucide-react';

export default function VoiceCommandModal({ isOpen, onClose, onActionExecuted }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusText, setStatusText] = useState('Tap the microphone and speak your command');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [showJson, setShowJson] = useState(false);

  // Parsed AI result
  const [aiResult, setAiResult] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', message }

  // Approval for Sale
  const [saleApproval, setSaleApproval] = useState(null);

  // Dialog for Debtor Contact & Location
  const [debtorDialog, setDebtorDialog] = useState(null);
  const [debtorContact, setDebtorContact] = useState('');
  const [debtorLocation, setDebtorLocation] = useState('');
  const [debtorNotes, setDebtorNotes] = useState('');

  // Info Query Results
  const [queryData, setQueryData] = useState(null);

  // Live in-stock items for local matching
  const [stockItems, setStockItems] = useState([]);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // Fetch in-stock items on open for offline matching
  useEffect(() => {
    if (isOpen) {
      api.get('/tables/instock')
        .then(res => setStockItems(res.data || []))
        .catch(() => {});
    }
  }, [isOpen]);

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setStatusText('Listening... Speak now');
      };

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setStatusText('Microphone permission blocked. You can still type below.');
        } else {
          setStatusText('Stopped listening. Tap the mic to try again.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setStatusText('Speech recognition not supported in this browser. You can type commands below.');
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) {}
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Text to Speech
  const speak = (text) => {
    if (voiceMuted || !('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha')));
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch(e) {
      console.warn('Speech synthesis error:', e);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      setIsListening(false);
    } else {
      stopSpeaking();
      setAiResult(null);
      setSaleApproval(null);
      setDebtorDialog(null);
      setQueryData(null);
      setFeedback(null);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch(e) {
          console.warn('Recognition start error:', e);
          setIsListening(false);
        }
      }
    }
  };

  // Interpret speech locally or via backend AI
  const processCommandText = async (textToProcess) => {
    const rawText = (textToProcess || transcript).trim();
    if (!rawText) return;

    setIsProcessing(true);
    setStatusText('Processing your command...');
    setFeedback(null);
    setSaleApproval(null);
    setDebtorDialog(null);
    setQueryData(null);

    try {
      // First try backend NLP/AI endpoint
      let response;
      try {
        const res = await api.post('/ai/command', { text: rawText });
        response = res.data;
      } catch (err) {
        console.warn('Backend AI command error, falling back to client parser:', err);
        response = parseLocally(rawText, stockItems);
      }

      setAiResult(response);
      setStatusText('Command analyzed');

      // Handle query intents
      if (response.type === 'query_stock' || response.type === 'query_sales_today' || response.type === 'query_debtors') {
        setQueryData(response);
        if (response.speechResponse) {
          speak(response.speechResponse);
        }
      }
      // Handle Sale Approval Intent
      else if (response.type === 'sale') {
        setSaleApproval(response.command);
        if (response.speechResponse) {
          speak(response.speechResponse);
        }
      }
      // Handle Debtor Dialog Intent
      else if (response.type === 'debtor') {
        setDebtorDialog(response.command);
        setDebtorContact('');
        setDebtorLocation('');
        setDebtorNotes('');
        if (response.speechResponse) {
          speak(response.speechResponse);
        }
      } else {
        // Unknown or general command
        if (response.speechResponse) {
          speak(response.speechResponse);
        }
      }

    } catch (e) {
      console.error('Command processing error:', e);
      setFeedback({ type: 'error', message: 'Failed to process command. Please try again.' });
      setStatusText('Error processing command');
    } finally {
      setIsProcessing(false);
    }
  };

  // Client-side instant offline natural language parser
  const parseLocally = (text, items = []) => {
    const lower = text.toLowerCase();

    // Query 1: Remaining products
    if (lower.includes('remaining') || lower.includes('in stock') || lower.includes('stock remaining') || lower.includes('products remaining') || lower.includes('left in stock')) {
      const totalUnits = items.reduce((acc, r) => acc + (r.quantity || 0), 0);
      const topFew = items.slice(0, 3).map(i => `${i.item_number} (${i.quantity} units)`).join(', ');
      const speech = items.length > 0
        ? `You have ${items.length} products in stock with ${totalUnits.toLocaleString()} units remaining. Top items are: ${topFew}.`
        : 'There are no products in stock currently.';
      return {
        type: 'query_stock',
        intent: 'Products remaining in stock',
        speechResponse: speech,
        data: { totalProducts: items.length, totalUnits, items }
      };
    }

    // Query 2: Sold today
    if (lower.includes('sold today') || lower.includes('sales today') || lower.includes('what was sold today') || lower.includes('ones that was sold today')) {
      return {
        type: 'query_sales_today',
        intent: "Today's sales",
        speechResponse: 'Fetching today’s sales from your inventory records...',
        data: { totalSold: 0, totalRevenue: 0, items: [] }
      };
    }

    // Debtor command: e.g. "Abu collected 5 pieces of ITM-002 and is owing me 10000"
    const debtorRegex = /(?:([a-zA-Z\s]+?)\s+(?:collected|took|borrowed|received))\s+(\d+)\s*(?:pieces|pcs|units|items)?(?:\s+of\s+([a-zA-Z0-9_\-]+))?(?:\s+(?:and\s+is\s+owing|and\s+owes|and\s+not\s+paid|owing|owes)\s*(?:me)?\s*(?:₦|naira)?\s*([\d,]+)?)?/i;
    const debtorMatch = text.match(debtorRegex);

    if (debtorMatch || (lower.includes('collected') && (lower.includes('owing') || lower.includes('not paid')))) {
      let cust = debtorMatch?.[1]?.trim() || 'Abu';
      cust = cust.replace(/^(a customer|someone|somebody|yesterday|today)\s+/i, '').trim();
      const qty = debtorMatch?.[2] ? Number(debtorMatch[2]) : 1;
      let itm = debtorMatch?.[3]?.trim() || '';
      let price = debtorMatch?.[4] ? Number(debtorMatch[4].replace(/,/g, '')) : 0;

      if (!itm) {
        for (const s of items) {
          if (lower.includes(s.item_number.toLowerCase())) {
            itm = s.item_number;
            break;
          }
        }
      }
      if (!price && itm) {
        const found = items.find(s => s.item_number.toLowerCase() === itm.toLowerCase());
        if (found) price = found.price * qty;
      }

      return {
        type: 'debtor',
        intent: 'Add Debtor Command',
        requiresDialog: true,
        speechResponse: `I detected a debtor command for ${cust}. Please enter their contact and location details to complete the command.`,
        command: {
          action: 'add_debtor',
          customer_name: cust,
          item_number: itm || 'Item',
          quantity: qty,
          amount_owed: price
        }
      };
    }

    // Sale command: e.g. "Somebody bought 300 pieces of ITM-001"
    const saleRegex = /(?:(?:somebody|someone|customer|a customer|user|buyer)?\s*(?:bought|purchased|sold|sell)\s+)?(\d+)\s*(?:pieces|pcs|units|items)?(?:\s+of\s+)?([a-zA-Z0-9_\-]+)(?:\s+(?:for|at)\s*(?:₦|naira)?\s*([\d,]+))?/i;
    const saleMatch = text.match(saleRegex);

    if (saleMatch || lower.includes('bought') || lower.includes('sold')) {
      const qty = saleMatch?.[1] ? Number(saleMatch[1]) : 1;
      let itm = saleMatch?.[2]?.trim() || '';
      let price = saleMatch?.[3] ? Number(saleMatch[3].replace(/,/g, '')) : 0;

      if (!itm || itm.toLowerCase() === 'item') {
        for (const s of items) {
          if (lower.includes(s.item_number.toLowerCase())) {
            itm = s.item_number;
            break;
          }
        }
      }

      const found = items.find(s => s.item_number.toLowerCase() === itm.toLowerCase());
      if (found && !price) price = found.price * qty;

      return {
        type: 'sale',
        intent: 'Record Sale Command',
        requiresApproval: true,
        speechResponse: `I parsed a sale command for ${qty} pieces of ${itm || 'item'}. Please review and approve it to record the sale.`,
        command: {
          action: 'record_sale',
          item_number: found ? found.item_number : (itm || 'ITM-001'),
          quantity: qty,
          price: price || 0,
          customer_info: 'Customer (Voice command)'
        }
      };
    }

    return {
      type: 'unknown',
      intent: 'General voice input',
      speechResponse: `I heard: "${text}". You can ask about products remaining, sales today, or say "Somebody bought 300 pieces of ITM-001".`,
      command: null
    };
  };

  // Execute Sale Command on User Approval
  const handleApproveSale = async () => {
    if (!saleApproval) return;
    setIsProcessing(true);
    try {
      const res = await api.post('/tables/soldout', {
        item_number: saleApproval.item_number,
        quantity: Number(saleApproval.quantity),
        price: Number(saleApproval.price),
        customer_info: saleApproval.customer_info || 'Walk-in buyer'
      });

      const remaining = res.data?.stockRemaining !== undefined ? res.data.stockRemaining : 'updated';
      const msg = `Sale of ${saleApproval.quantity} pieces of "${saleApproval.item_number}" recorded successfully. Stock remaining: ${remaining}.`;
      setFeedback({ type: 'success', message: msg });
      speak(`Sale approved! Recorded ${saleApproval.quantity} pieces of ${saleApproval.item_number}. Stock remaining is now ${remaining}.`);
      setSaleApproval(null);

      if (onActionExecuted) onActionExecuted('sale');
    } catch(err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to record sale';
      setFeedback({ type: 'error', message: errMsg });
      speak(`Failed to record sale: ${errMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute Debtor Command after filling Contact and Location
  const handleSaveDebtorDialog = async (e) => {
    e.preventDefault();
    if (!debtorDialog) return;
    setIsProcessing(true);

    const fullCustomerInfo = [
      debtorDialog.customer_name,
      debtorContact ? `Phone: ${debtorContact.trim()}` : '',
      debtorLocation ? `Location: ${debtorLocation.trim()}` : '',
      debtorNotes ? `Note: ${debtorNotes.trim()}` : ''
    ].filter(Boolean).join(' | ');

    try {
      await api.post('/tables/debtors', {
        customer_info: fullCustomerInfo,
        item_number: debtorDialog.item_number,
        quantity: Number(debtorDialog.quantity),
        price: Number(debtorDialog.amount_owed)
      });

      const msg = `Debtor record added for ${debtorDialog.customer_name} (${debtorDialog.quantity} units of "${debtorDialog.item_number}" - ₦${Number(debtorDialog.amount_owed).toLocaleString()}). Stock deducted.`;
      setFeedback({ type: 'success', message: msg });
      speak(`Debtor command executed! Recorded ${debtorDialog.customer_name} owing ${Number(debtorDialog.amount_owed).toLocaleString()} naira for ${debtorDialog.quantity} pieces of ${debtorDialog.item_number}.`);
      setDebtorDialog(null);

      if (onActionExecuted) onActionExecuted('debtor');
    } catch(err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to add debtor';
      setFeedback({ type: 'error', message: errMsg });
      speak(`Failed to add debtor: ${errMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{ zIndex: 1200, padding: 16 }}>
      <div className="modal" style={{ maxWidth: 640, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 0, borderRadius: 16, border: '2px solid #000000' }}>
        
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '2px solid #000000',
          background: 'linear-gradient(to right, #ffffff, #f8fafc)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'var(--accent-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                Light Shop Voice AI
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                Voice Command & Assistant Window
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                if (!voiceMuted) stopSpeaking();
                setVoiceMuted(!voiceMuted);
              }}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #000000' }}
              title={voiceMuted ? 'Unmute voice' : 'Mute voice'}
            >
              {voiceMuted ? <VolumeX size={15} color="var(--red)" /> : <Volume2 size={15} color="var(--accent)" />}
              <span style={{ fontSize: 11 }}>{voiceMuted ? 'Muted' : 'Voice On'}</span>
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 4 }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>

          {/* Interactive Voice Hub */}
          <div style={{
            background: 'var(--bg-subtle)',
            border: '2px solid #000000',
            borderRadius: 14,
            padding: '24px 20px',
            textAlign: 'center',
            marginBottom: 20
          }}>
            {/* Pulsing Mic Button */}
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 14 }}>
              <button
                onClick={toggleListening}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  background: isListening ? 'var(--red)' : 'var(--accent)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isListening ? '0 0 0 12px rgba(239, 68, 68, 0.2)' : '0 4px 20px rgba(37, 99, 235, 0.35)',
                  transition: 'all 0.25s ease',
                  animation: isListening ? 'pulseGlow 1.4s infinite' : 'none'
                }}
                title={isListening ? 'Stop listening' : 'Start voice command'}
              >
                {isListening ? <MicOff size={32} /> : <Mic size={32} />}
              </button>
            </div>

            {/* Status text */}
            <div style={{ fontWeight: 600, fontSize: 14, color: isListening ? 'var(--red)' : 'var(--text)', marginBottom: 4 }}>
              {statusText}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {isListening ? 'Speak naturally. Press mic again to stop and parse.' : 'Tap the blue mic button or type a command below'}
            </div>

            {/* Sound Wave Animation when listening or speaking */}
            {(isListening || isSpeaking) && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 14 }}>
                <span style={{ fontSize: 11, color: isSpeaking ? 'var(--accent)' : 'var(--red)', fontWeight: 600, marginRight: 6 }}>
                  {isSpeaking ? 'Speaking response:' : 'Detecting voice:'}
                </span>
                {[0.2, 0.4, 0.1, 0.5, 0.3, 0.6, 0.2].map((delay, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: 4,
                      background: isSpeaking ? 'var(--accent)' : 'var(--red)',
                      borderRadius: 3,
                      height: 12,
                      animation: `soundwave 0.8s ease-in-out infinite`,
                      animationDelay: `${delay}s`
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Spoken Text Transcript & Input */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                Spoken or Typed Voice Command
              </label>
              {transcript && (
                <button
                  onClick={() => setTranscript('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                >
                  Clear text
                </button>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <textarea
                className="form-input"
                rows={2}
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    processCommandText();
                  }
                }}
                placeholder='e.g. "Somebody bought 300 pieces of ITM-001" or "What products are remaining?"'
                style={{ paddingRight: 90, fontSize: 14, resize: 'vertical' }}
              />
              <button
                onClick={() => processCommandText()}
                disabled={isProcessing || !transcript.trim()}
                className="btn btn-primary"
                style={{ position: 'absolute', right: 8, bottom: 8, padding: '7px 12px', borderRadius: 6, fontSize: 12 }}
              >
                {isProcessing ? <span className="spinner"></span> : <><Send size={13} /> Process</>}
              </button>
            </div>
          </div>

          {/* Quick Click-to-Test Prompts */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Try sample voice commands:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { label: 'Sale of 300 pieces', text: 'Somebody bought 300 pieces of ITM-001' },
                { label: 'Abu collected & owes', text: 'Abu collected 5 pieces of ITM-002 and is owing me 10000' },
                { label: 'Abu not paid at all', text: 'Abu collected 3 pieces of ITM-001 and not paid at all' },
                { label: 'Products remaining?', text: 'What products are remaining?' },
                { label: 'Sold today?', text: 'The ones that was sold today' },
                { label: 'Who is owing?', text: 'Who is owing me money?' }
              ].map(chip => (
                <button
                  key={chip.label}
                  onClick={() => {
                    setTranscript(chip.text);
                    processCommandText(chip.text);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{
                    background: 'var(--bg-card)',
                    fontSize: 11,
                    padding: '5px 11px',
                    borderRadius: 20,
                    border: '1px solid var(--border)'
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback message banner */}
          {feedback && (
            <div className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 20 }}>
              {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span style={{ flex: 1 }}>{feedback.message}</span>
              <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* 1. SALE APPROVAL CARD (Shows exact text + approval to avoid errors) */}
          {saleApproval && (
            <div style={{
              background: 'var(--bg-card)',
              border: '2px solid var(--accent)',
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              boxShadow: '0 4px 16px rgba(37, 99, 235, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShoppingCart size={18} color="var(--accent)" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)' }}>
                    Confirm & Approve Sale
                  </span>
                </div>
                <span className="badge badge-admin">Awaiting Approval</span>
              </div>

              <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: 'var(--text-muted)' }}>
                <strong>Spoken:</strong> "{transcript}"
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
                <div>
                  <label className="form-label">Item Number</label>
                  <input
                    className="form-input"
                    value={saleApproval.item_number}
                    onChange={e => setSaleApproval({ ...saleApproval, item_number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Quantity Sold</label>
                  <input
                    type="number"
                    className="form-input"
                    value={saleApproval.quantity}
                    onChange={e => setSaleApproval({ ...saleApproval, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Total Price (₦)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={saleApproval.price}
                    onChange={e => setSaleApproval({ ...saleApproval, price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Customer Info</label>
                  <input
                    className="form-input"
                    value={saleApproval.customer_info}
                    onChange={e => setSaleApproval({ ...saleApproval, customer_info: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSaleApproval(null)}
                  className="btn btn-secondary btn-sm"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleApproveSale}
                  disabled={isProcessing}
                  className="btn btn-primary"
                  style={{ gap: 6 }}
                >
                  {isProcessing ? <span className="spinner"></span> : <><CheckCircle2 size={16} /> Approve & Record Sale</>}
                </button>
              </div>
            </div>
          )}

          {/* 2. DEBTOR CONTACT & LOCATION DIALOG */}
          {debtorDialog && (
            <div style={{
              background: 'var(--bg-card)',
              border: '2px solid var(--orange)',
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              boxShadow: '0 4px 16px rgba(245, 158, 11, 0.12)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserCheck size={18} color="var(--orange)" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: 'var(--orange)' }}>
                    Fill Debtor Information: {debtorDialog.customer_name}
                  </span>
                </div>
                <span className="badge" style={{ background: 'var(--orange-dim)', color: 'var(--orange)' }}>Debtor Action</span>
              </div>

              <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: 'var(--text-muted)' }}>
                <strong>Spoken:</strong> "{transcript}"
              </div>

              <form onSubmit={handleSaveDebtorDialog}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label className="form-label">Customer Name</label>
                    <input
                      className="form-input"
                      value={debtorDialog.customer_name}
                      onChange={e => setDebtorDialog({ ...debtorDialog, customer_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Item Number</label>
                    <input
                      className="form-input"
                      value={debtorDialog.item_number}
                      onChange={e => setDebtorDialog({ ...debtorDialog, item_number: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Quantity Taken</label>
                    <input
                      type="number"
                      className="form-input"
                      value={debtorDialog.quantity}
                      onChange={e => setDebtorDialog({ ...debtorDialog, quantity: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Amount Owed (₦)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={debtorDialog.amount_owed}
                      onChange={e => setDebtorDialog({ ...debtorDialog, amount_owed: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Specific Contact and Location Fields requested */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={12} color="var(--accent)" /> Contact / Phone Number
                    </label>
                    <input
                      className="form-input"
                      placeholder="e.g. 08012345678"
                      value={debtorContact}
                      onChange={e => setDebtorContact(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} color="var(--accent)" /> Location / Address
                    </label>
                    <input
                      className="form-input"
                      placeholder="e.g. Shop 12, Central Market, Lagos"
                      value={debtorLocation}
                      onChange={e => setDebtorLocation(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Additional Note (optional)</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Promised to pay next Monday"
                    value={debtorNotes}
                    onChange={e => setDebtorNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setDebtorDialog(null)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="btn btn-primary"
                    style={{ gap: 6, background: 'var(--orange)' }}
                  >
                    {isProcessing ? <span className="spinner"></span> : <><CheckCircle2 size={16} /> Save Debtor Command</>}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 3. INFORMATION QUERY RESPONSE CARD */}
          {queryData && (
            <div style={{
              background: 'var(--bg-card)',
              border: '2px solid #000000',
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package size={18} color="var(--accent)" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, textTransform: 'uppercase' }}>
                    {queryData.intent}
                  </span>
                </div>
                <button
                  onClick={() => speak(queryData.speechResponse)}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: 4, padding: '4px 8px', fontSize: 11, border: '1.5px solid #000000' }}
                >
                  <Volume2 size={13} color="var(--accent)" /> Replay Voice
                </button>
              </div>

              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)', marginBottom: 14 }}>
                {queryData.speechResponse}
              </div>

              {/* Data Items Preview */}
              {queryData.data?.items && queryData.data.items.length > 0 && (
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '2px solid #000000', borderRadius: 8 }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #000000' }}>
                        <th style={{ padding: '8px 10px', color: '#000000', fontWeight: 700, borderRight: '1px solid #000000', borderBottom: '2px solid #000000' }}>Item Number</th>
                        <th style={{ padding: '8px 10px', color: '#000000', fontWeight: 700, borderRight: '1px solid #000000', borderBottom: '2px solid #000000' }}>Quantity</th>
                        <th style={{ padding: '8px 10px', color: '#000000', fontWeight: 700, borderBottom: '2px solid #000000' }}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queryData.data.items.slice(0, 10).map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #000000' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, borderRight: '1px solid #000000' }}>{it.item_number}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--accent)', fontWeight: 700, borderRight: '1px solid #000000' }}>{it.quantity} units</td>
                          <td style={{ padding: '8px 10px' }}>₦{Number(it.price || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* JSON Command View Dropdown */}
          <div style={{ borderTop: '2px solid #000000', paddingTop: 16, marginTop: 10 }}>
            <button
              onClick={() => setShowJson(!showJson)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--font-mono)'
              }}
            >
              <Code2 size={14} />
              <span>Generated JSON Command Preview</span>
              {showJson ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showJson && (
              <pre style={{
                background: '#0f172a',
                color: '#38bdf8',
                borderRadius: 8,
                padding: 14,
                marginTop: 10,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                overflowX: 'auto',
                lineHeight: 1.5
              }}>
                {JSON.stringify(aiResult || {
                  intent: 'READY',
                  input: transcript || 'No voice command spoken yet',
                  app_command: null
                }, null, 2)}
              </pre>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
