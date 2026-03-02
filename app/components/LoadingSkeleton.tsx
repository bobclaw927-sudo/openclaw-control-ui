'use client';

export function SessionCardSkeleton() {
  return (
    <div className="px-6 py-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="h-4 bg-gray-700 rounded w-48 mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-96 mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-64"></div>
        </div>
        <div className="text-right">
          <div className="h-4 bg-gray-700 rounded w-32 mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-20 mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-24"></div>
        </div>
      </div>
      <div className="mt-3 bg-gray-700 rounded-full h-2 w-full"></div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="h-3 bg-gray-700 rounded w-24 mb-3"></div>
          <div className="h-8 bg-gray-700 rounded w-16"></div>
        </div>
        <div className="w-12 h-12 bg-gray-700 rounded-lg"></div>
      </div>
    </div>
  );
}

export function ConsoleMessageSkeleton() {
  return (
    <div className="flex items-start space-x-2 animate-pulse">
      <div className="w-4 h-4 bg-gray-700 rounded-full flex-shrink-0"></div>
      <div className="w-20 h-3 bg-gray-700 rounded flex-shrink-0"></div>
      <div className="flex-1 h-3 bg-gray-700 rounded"></div>
    </div>
  );
}
