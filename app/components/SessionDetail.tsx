'use client';

import { X, Trash2, RefreshCw, Download, MessageSquare } from 'lucide-react';

interface Session {
  key: string;
  model: string;
  contextTokens: number;
  totalTokens: number;
  updatedAt: number;
  displayName?: string;
}

interface SessionDetailProps {
  session: Session;
  onClose: () => void;
  onRefresh?: () => void;
  onDelete?: () => void;
  onExport?: () => void;
}

export function SessionDetail({ session, onClose, onRefresh, onDelete, onExport }: SessionDetailProps) {
  const usagePercent = (session.contextTokens / session.totalTokens) * 100;
  const formatDate = (ts: number) => new Date(ts).toLocaleString();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto border border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Session Details</h2>
            {session.displayName && (
              <p className="text-sm text-blue-400 mt-1">{session.displayName}</p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Session Key */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Session Key</label>
            <code className="block bg-black px-4 py-3 rounded-lg text-xs font-mono text-blue-400 break-all">
              {session.key}
            </code>
          </div>

          {/* Model */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Model</label>
            <p className="text-lg font-semibold">{session.model}</p>
          </div>

          {/* Token Usage */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Token Usage</label>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Context Tokens</span>
                <span className="text-lg font-semibold">{session.contextTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Tokens</span>
                <span className="text-lg font-semibold">{session.totalTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Usage</span>
                <span className={`text-lg font-semibold ${
                  usagePercent > 80 ? 'text-red-400' :
                  usagePercent > 50 ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {usagePercent.toFixed(1)}%
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="bg-gray-700 rounded-full h-3 mt-3">
                <div 
                  className={`h-3 rounded-full transition-all ${
                    usagePercent > 80 ? 'bg-red-500' :
                    usagePercent > 50 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Last Updated */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Last Updated</label>
            <p className="text-sm">{formatDate(session.updatedAt)}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            )}
            {onExport && (
              <button
                onClick={onExport}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
            <div className="bg-gray-900 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Remaining</p>
              <p className="text-2xl font-bold text-green-400">
                {(session.totalTokens - session.contextTokens).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">tokens</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Est. Messages</p>
              <p className="text-2xl font-bold text-blue-400">
                ~{Math.floor((session.totalTokens - session.contextTokens) / 500)}
              </p>
              <p className="text-xs text-gray-500">at 500 tokens each</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
