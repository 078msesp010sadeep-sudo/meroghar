import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Volume2, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface AudioTranscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptionComplete: (text: string) => void;
  title?: string;
  subtitle?: string;
}

export function AudioTranscribeModal({
  isOpen,
  onClose,
  onTranscriptionComplete,
  title = 'Voice Input & Audio Transcription',
  subtitle = 'Speak in English or Nepali. Transcribed via gemini-3.5-transcribe.',
}: AudioTranscribeModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribedResult, setTranscribedResult] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      stopRecordingImmediate();
      setRecordingSeconds(0);
      setTranscribedResult('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  const startRecording = async () => {
    try {
      setErrorMsg(null);
      setTranscribedResult('');
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        await processAudioTranscription();
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access error:', err);
      setErrorMsg('Could not access microphone. Please check browser microphone permissions.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const stopRecordingImmediate = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
    }
    setIsRecording(false);
  };

  const processAudioTranscription = async () => {
    try {
      setIsProcessing(true);
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || 'audio/webm',
      });

      if (audioBlob.size === 0) {
        throw new Error('Recorded audio was empty. Please try speaking again.');
      }

      // Convert Blob to Base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          // Strip prefix "data:audio/...;base64,"
          const base64 = res.split(',')[1] || '';
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const audioBase64 = await base64Promise;

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: audioBlob.type || 'audio/webm',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      const text = data.transcription || '';
      setTranscribedResult(text);
    } catch (err: any) {
      console.error('Transcription error:', err);
      setErrorMsg(err.message || 'Failed to transcribe audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-indigo-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{title}</h3>
              <p className="text-xs text-white/80">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Recording Status Visualizer */}
          <div className="flex flex-col items-center justify-center py-6 bg-slate-50 rounded-2xl border border-slate-200/80">
            {isRecording ? (
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-red-500/20 animate-ping absolute inset-0" />
                  <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center relative shadow-lg shadow-red-500/40">
                    <Mic className="w-8 h-8 text-white animate-pulse" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                  <span className="font-mono text-lg font-bold text-slate-800">
                    {formatSeconds(recordingSeconds)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Listening to your voice... Click Stop when finished.</p>
              </div>
            ) : isProcessing ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                <p className="text-sm font-semibold text-slate-800">Transcribing with gemini-3.5-transcribe...</p>
                <p className="text-xs text-slate-500">Processing audio waveform and language tokens</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Volume2 className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-800">Ready to Record Voice</p>
                  <p className="text-xs text-slate-500 max-w-xs mt-0.5">
                    Describe your maintenance issue, ask a tenancy question, or dictate a community notice.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Transcribed Output Preview */}
          {transcribedResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Transcribed Text (gemini-3.5-transcribe)
                </span>
                <span className="text-slate-400 font-mono text-[11px]">{transcribedResult.length} chars</span>
              </div>
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-sm text-slate-800 leading-relaxed font-sans max-h-40 overflow-y-auto">
                {transcribedResult}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {!isRecording && !isProcessing && (
              <button
                type="button"
                onClick={startRecording}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-98"
              >
                <Mic className="w-4 h-4" />
                Start Voice Recording
              </button>
            )}

            {isRecording && (
              <button
                type="button"
                onClick={stopRecording}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition"
              >
                <Square className="w-4 h-4 fill-white" />
                Stop & Transcribe
              </button>
            )}

            {transcribedResult && (
              <button
                type="button"
                onClick={() => {
                  onTranscriptionComplete(transcribedResult);
                  onClose();
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                Apply Transcription
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={isRecording || isProcessing}
              className="py-3 px-4 rounded-xl border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
