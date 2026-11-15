import { adminFetch } from '../utils/adminApi';
import React, { useState, useRef, useEffect } from 'react';
import { 
  FileUp, Link as LinkIcon, Check, Eye, Trash2, 
  FileText, UploadCloud, AlertCircle, RefreshCw, Smartphone, Cloud
} from 'lucide-react';
import { optimizePdfUrl } from '../utils/pdfOptimizer';

interface PdfUploadInputProps {
  pdfUrl: string;
  onPdfUrlChange: (url: string) => void;
  token?: string;
  onFileUploaded?: (meta: { 
    filename: string; 
    fileSize: string; 
    url: string; 
    dataUrl?: string;
    downloadUrl?: string;
    b2FileId?: string;
    b2FileName?: string;
    mimeType?: string;
  }) => void;
  onPreviewTest?: (url: string) => void;
  titleValue?: string;
  onTitleSuggest?: (title: string) => void;
}

export const PdfUploadInput: React.FC<PdfUploadInputProps> = ({
  pdfUrl,
  onPdfUrlChange,
  token,
  onFileUploaded,
  onPreviewTest,
  titleValue,
  onTitleSuggest
}) => {
  const [mode, setMode] = useState<'upload' | 'url'>(
    pdfUrl && !pdfUrl.includes('/api/files/') && !pdfUrl.startsWith('data:') ? 'url' : 'upload'
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>(() => {
    if (pdfUrl.includes('/api/files/pdf/')) {
      const parts = pdfUrl.split('/');
      return decodeURIComponent(parts[parts.length - 1]?.split('#')[0] || 'Uploaded Document.pdf');
    }
    return '';
  });
  const [uploadedFileSize, setUploadedFileSize] = useState<string>('');
  const [b2Status, setB2Status] = useState<{ connected: boolean; bucket?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    adminFetch('/api/admin/b2-status')
      .then(r => r.json())
      .then(data => setB2Status(data))
      .catch(() => {});
  }, []);

  // Format bytes to readable size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Process selected file
  const processFile = async (file: File) => {
    if (!file) return;

    // Validate type (must be PDF or supported study format)
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setUploadError('Please select a valid PDF document (.pdf).');
      return;
    }

    // Validate size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('PDF file size is too large (max 50 MB).');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    const formattedSize = formatBytes(file.size);
    const cleanFilename = file.name;
    setUploadedFileName(cleanFilename);
    setUploadedFileSize(formattedSize);

    // Auto-suggest document title if current title is empty
    if ((!titleValue || titleValue.trim() === '') && onTitleSuggest) {
      const suggested = cleanFilename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
      onTitleSuggest(suggested);
    }

    try {
      // Read file as Base64 Data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      // Try uploading to server endpoint & Backblaze B2
      let serverUrl = '';
      let serverDownloadUrl = '';
      let b2FileId: string | undefined;
      let b2FileName: string | undefined;
      let returnedMime: string | undefined;

      try {
        const response = await adminFetch('/api/admin/upload-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            filename: cleanFilename,
            dataBase64: dataUrl,
            mimeType: file.type || 'application/pdf'
          })
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.url) {
            serverUrl = resData.url;
          }
          if (resData.downloadUrl) {
            serverDownloadUrl = resData.downloadUrl;
          }
          b2FileId = resData.b2FileId;
          b2FileName = resData.b2FileName;
          returnedMime = resData.mimeType;
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn('Server upload error:', errData?.error);
        }
      } catch (networkErr) {
        console.warn('Server upload fallback to direct data URL:', networkErr);
      }

      // If server returned URL, use it; otherwise fallback to dataUrl
      const finalUrl = serverUrl || dataUrl;
      onPdfUrlChange(finalUrl);

      if (onFileUploaded) {
        onFileUploaded({
          filename: cleanFilename,
          fileSize: formattedSize,
          url: finalUrl,
          dataUrl,
          downloadUrl: serverDownloadUrl,
          b2FileId,
          b2FileName,
          mimeType: returnedMime || file.type || 'application/pdf'
        });
      }
    } catch (err: any) {
      console.error('Error reading PDF file:', err);
      setUploadError('Failed to read PDF file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemoveFile = () => {
    onPdfUrlChange('');
    setUploadedFileName('');
    setUploadedFileSize('');
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const opt = optimizePdfUrl(pdfUrl);
  const isUploaded = Boolean(
    pdfUrl && 
    (pdfUrl.includes('/api/files/') || pdfUrl.startsWith('data:') || pdfUrl.startsWith('blob:') || uploadedFileName)
  );

  return (
    <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-3">
      
      {/* Header and Mode Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="font-bold text-purple-950 text-xs sm:text-sm flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#4A1D96]" />
            <span>PDF Study Material Source</span>
          </label>
          {b2Status?.connected ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-md">
              <Cloud className="w-2.5 h-2.5 text-emerald-700" />
              <span>Backblaze B2 Active</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-800 bg-white border border-purple-200 px-2 py-0.5 rounded-md">
              <Cloud className="w-2.5 h-2.5 text-purple-600" />
              <span>Cloud Storage Ready</span>
            </span>
          )}
        </div>

        {/* Mode Toggle Pills */}
        <div className="flex items-center bg-white p-0.5 rounded-lg border border-purple-200 text-xs">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              mode === 'upload'
                ? 'bg-[#4A1D96] text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-900'
            }`}
          >
            <UploadCloud className="w-3 h-3" />
            <span>Upload from Gallery / Files</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('url')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              mode === 'url'
                ? 'bg-[#4A1D96] text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-900'
            }`}
          >
            <LinkIcon className="w-3 h-3" />
            <span>Cloud Link URL</span>
          </button>
        </div>
      </div>

      {/* MODE 1: UPLOAD FROM DEVICE / GALLERY / FILE SYSTEM */}
      {mode === 'upload' && (
        <div className="space-y-3">
          
          {/* Hidden native input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileInputChange}
            className="hidden"
            id="pdf-file-upload-input"
          />

          {isUploaded && pdfUrl.trim() ? (
            /* Uploaded File Card */
            <div className="bg-white rounded-xl border border-emerald-200 p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {uploadedFileName || 'Uploaded Document.pdf'}
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>{uploadedFileSize || 'PDF Document'}</span>
                      <span className="inline-block w-1 h-1 rounded-full bg-slate-300" />
                      <span className="text-emerald-700 font-semibold">Ready for View-Only Reader</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {onPreviewTest && (
                    <button
                      type="button"
                      onClick={() => onPreviewTest(pdfUrl)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                      title="Test View in Protected Reader"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Test View</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-slate-500 hover:text-[#4A1D96] hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                    title="Replace with another PDF file"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-[11px] bg-emerald-50/70 border border-emerald-100 rounded-lg px-2.5 py-1.5 text-emerald-800 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>Protected with anti-download security, watermarking, and print restrictions.</span>
              </div>
            </div>
          ) : (
            /* Upload Dropzone / Button */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 sm:p-6 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-[#4A1D96] bg-purple-100/50 scale-[1.01]'
                  : 'border-purple-200 hover:border-[#4A1D96] bg-white hover:bg-purple-50/40'
              }`}
            >
              <div className="max-w-md mx-auto space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-100 text-[#4A1D96] flex items-center justify-center shadow-xs">
                  {isUploading ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    <FileUp className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <p className="font-bold text-xs sm:text-sm text-slate-800">
                    {isUploading ? (
                      'Processing & Encrypting PDF...'
                    ) : (
                      <>
                        <span className="text-[#4A1D96] underline underline-offset-2">Click to browse your Gallery or Files</span> or drag & drop
                      </>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-center gap-1.5">
                    <Smartphone className="w-3 h-3 text-purple-600" />
                    <span>Supports PDF documents from Phone Gallery, Downloads & File Manager (up to 50MB)</span>
                  </p>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    disabled={isUploading}
                    className="px-4 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Choose PDF from Files / Gallery</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: PASTE CLOUD URL (Google Drive, OneDrive, direct link) */}
      {mode === 'url' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="url"
              placeholder="https://drive.google.com/file/d/... or direct .pdf link"
              value={pdfUrl}
              onChange={(e) => onPdfUrlChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-slate-900 font-mono text-[11px] focus:outline-hidden focus:border-[#4A1D96]"
            />
            {pdfUrl.trim() && onPreviewTest && (
              <button
                type="button"
                onClick={() => onPreviewTest(pdfUrl)}
                className="px-2.5 py-2 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold text-[11px] flex items-center gap-1 flex-shrink-0 cursor-pointer shadow-xs"
                title="Test View in Reader"
              >
                <Eye className="w-3 h-3" />
                <span>Test</span>
              </button>
            )}
          </div>

          {/* Auto-Optimization Status Feedback */}
          {pdfUrl.trim() ? (
            <div className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-xl flex items-start gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold">{opt.provider} Detected: </span>
                <span>{opt.optimizationNote}</span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              💡 Paste any Google Drive (set sharing to "Anyone with link can view"), OneDrive, or direct PDF link.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
