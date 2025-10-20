import { getActiveContext } from '@/lib/mode/getActiveContext';
import { getHomeSnapshot } from '@/features/home/loaders';
import { homeCardRegistry } from '@/features/home/registry';

export default async function DashboardHome() {
  const pageStartTime = performance.now();
  
  const context = await getActiveContext();

  if (!context) {
    return null; // Layout will handle redirect
  }

  const description = context.variant === 'agency'
    ? "Here's what's active across your agency"
    : "Here's what's happening across your agencies";

  // Await all data on the server for instant rendering
  const snapshotStartTime = performance.now();
  const snapshot = await getHomeSnapshot(context);
  console.log(`[Performance] getHomeSnapshot: ${(performance.now() - snapshotStartTime).toFixed(2)}ms`);
  
  const cards = homeCardRegistry(context);
  
  console.log(`[Performance] DashboardHome TOTAL: ${(performance.now() - pageStartTime).toFixed(2)}ms`);

  return (
    <div style={{ padding: '24px 16px 24px 24px' }}>
      <div className="mb-6">
        <h1 className="display-9-medium mb-3" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
          You&apos;re in, {context.user.firstName}
        </h1>
        <p className="text-sm-regular" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
          {description}
        </p>
      </div>
      
      {/* Stats Cards Grid - First Row */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {cards.slice(0, 4).map(({ key, Component }) => (
          <Component key={key} snapshot={snapshot} context={context} />
        ))}
      </div>
      
          {/* Additional Cards Grid - Second Row */}
          <div className="grid grid-cols-3 gap-4 mb-4 h-[370px]">
            {cards.slice(4, 5).map(({ key, Component }) => (
              <div key={key} className="col-span-2 h-full">
                <Component snapshot={snapshot} context={context} />
              </div>
            ))}
            {cards.slice(5, 6).map(({ key, Component }) => (
              <div key={key} className="col-span-1 h-full">
                <Component snapshot={snapshot} context={context} />
              </div>
            ))}
          </div>
          
          {/* Third Row Cards Grid */}
          <div className="grid grid-cols-3 gap-4 h-[370px]">
            {cards.slice(6, 7).map(({ key, Component }) => (
              <div key={key} className="col-span-2 h-full">
                <Component snapshot={snapshot} context={context} />
              </div>
            ))}
            {cards.slice(7, 8).map(({ key, Component }) => (
              <div key={key} className="col-span-1 h-full">
                <Component snapshot={snapshot} context={context} />
              </div>
            ))}
          </div>
    </div>
  );
}
