import React from 'react';

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
      {/* Left Column: Image Viewer Skeleton */}
      <div className="lg:col-span-7 bg-neo-bg rounded-neo p-6 shadow-neo-card flex flex-col gap-4 animate-pulse">
        <div className="h-6 w-1/4 bg-neo-shadow/40 rounded-full" />
        <div className="w-full h-[400px] md:h-[500px] bg-neo-shadow/20 rounded-neo flex items-center justify-center neo-inset border border-white/50">
          <div className="w-16 h-16 rounded-full border-4 border-t-neo-primary border-neo-shadow animate-spin" />
        </div>
        <div className="flex justify-between items-center mt-2">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-neo-shadow/40" />
            <div className="w-10 h-10 rounded-full bg-neo-shadow/40" />
            <div className="w-10 h-10 rounded-full bg-neo-shadow/40" />
            <div className="w-10 h-10 rounded-full bg-neo-shadow/40" />
          </div>
          <div className="w-32 h-10 rounded-full bg-neo-shadow/40" />
        </div>
      </div>

      {/* Right Column: Result List & Search Skeleton */}
      <div className="lg:col-span-5 bg-neo-bg rounded-neo p-6 shadow-neo-card flex flex-col gap-6 animate-pulse">
        {/* Search Bar Skeleton */}
        <div className="w-full h-12 bg-neo-shadow/30 rounded-full border border-white/50 neo-inset" />

        {/* Action Header Skeleton */}
        <div className="flex justify-between items-center">
          <div className="w-24 h-4 bg-neo-shadow/40 rounded-full" />
          <div className="flex gap-2">
            <div className="w-20 h-8 bg-neo-shadow/40 rounded-full" />
            <div className="w-20 h-8 bg-neo-shadow/40 rounded-full" />
          </div>
        </div>

        {/* List Skeletons */}
        <div className="flex flex-col gap-4 max-h-[450px] overflow-hidden pr-2">
          {[1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-neo-bg border border-white/40 rounded-neo shadow-neo-btn flex-wrap md:flex-nowrap gap-3"
            >
              <div className="flex items-center gap-3 w-full md:w-3/4">
                <div className="w-8 h-8 rounded-full bg-neo-shadow/40 flex-shrink-0 flex items-center justify-center text-xs font-bold text-neo-muted">
                  {index}
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <div className="h-4 bg-neo-shadow/40 rounded-full w-5/6" />
                  <div className="h-3 bg-neo-shadow/30 rounded-full w-2/3" />
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-shrink-0">
                <div className="w-12 h-6 bg-neo-shadow/40 rounded-full" />
                <div className="w-8 h-8 rounded-full bg-neo-shadow/40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
