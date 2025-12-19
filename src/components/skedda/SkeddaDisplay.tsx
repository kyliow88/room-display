'use client';

interface SkeddaConfig {
  spaceName: string;
  embedUrl?: string;
  icalUrl?: string;
  displayMode: 'embed' | 'ical' | 'status';
}

interface SkeddaDisplayProps {
  config: SkeddaConfig;
}

export default function SkeddaDisplay({ config }: SkeddaDisplayProps) {
  if (!config.embedUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/50 text-xl">No Skedda URL configured</div>
      </div>
    );
  }

  // For embed mode, show the Skedda booking page in an iframe
  return (
    <div className="min-h-screen pt-20">
      <iframe
        src={config.embedUrl}
        className="w-full h-[calc(100vh-5rem)] border-0"
        title="Skedda Booking"
        allow="fullscreen"
        style={{
          backgroundColor: 'white',
          borderRadius: '0',
        }}
      />
    </div>
  );
}
