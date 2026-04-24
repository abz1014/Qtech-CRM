import { RFQ, OrderStatus, RFQStatus } from '@/types/crm';
import { CheckCircle2, Circle, Package, Truck, CreditCard } from 'lucide-react';

interface TimelineStep {
  label: string;
  icon: React.ReactNode;
  completed: boolean;
  current: boolean;
}

interface RFQTimelineVisualizationProps {
  rfq: RFQ | null;
  order: { status: OrderStatus; confirmed_date: string | null } | null;
}

export function RFQTimelineVisualization({ rfq, order }: RFQTimelineVisualizationProps) {
  if (!rfq) return null;

  const getActiveStep = (): number => {
    if (!order) {
      if (rfq.status === 'new') return 0;
      if (rfq.status === 'in_progress') return 1;
      if (rfq.status === 'quoted') return 3;
      if (rfq.status === 'lost') return -1;
      if (rfq.status === 'converted') return 4;
    } else {
      if (order.status === 'quotation') return 3;
      if (order.status === 'confirmed') return 4;
      if (order.status === 'procurement') return 5;
      if (order.status === 'installation') return 5;
      if (order.status === 'completed') return 6;
    }
    return 0;
  };

  const activeStep = getActiveStep();

  const steps: TimelineStep[] = [
    {
      label: 'RFQ Received',
      icon: <Circle className="w-5 h-5" />,
      completed: activeStep >= 0,
      current: activeStep === 0
    },
    {
      label: 'Sent to Supplier',
      icon: <Circle className="w-5 h-5" />,
      completed: activeStep >= 1,
      current: activeStep === 1
    },
    {
      label: 'Got Best Quote',
      icon: <Package className="w-5 h-5" />,
      completed: activeStep >= 2,
      current: activeStep === 2
    },
    {
      label: 'Quote Sent to Client',
      icon: <Circle className="w-5 h-5" />,
      completed: activeStep >= 3,
      current: activeStep === 3
    },
    {
      label: 'Client Confirmed PO',
      icon: <CheckCircle2 className="w-5 h-5" />,
      completed: activeStep >= 4,
      current: activeStep === 4
    },
    {
      label: 'Shipped & Installed',
      icon: <Truck className="w-5 h-5" />,
      completed: activeStep >= 5,
      current: activeStep === 5
    },
    {
      label: 'Awaiting Payment',
      icon: <CreditCard className="w-5 h-5" />,
      completed: activeStep >= 6,
      current: activeStep === 6
    },
  ];

  if (activeStep === -1) {
    return (
      <div className="glass-card p-6 bg-destructive/10">
        <h3 className="font-semibold text-destructive mb-2">RFQ Lost</h3>
        <p className="text-sm text-muted-foreground">This RFQ did not result in an order.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-foreground mb-6">RFQ Workflow Timeline</h3>

      <div className="space-y-4">
        {steps.map((step, idx) => {
          const isCompleted = step.completed && !step.current;
          const isCurrent = step.current;

          return (
            <div key={idx} className="flex items-start gap-4">
              {/* Step Indicator */}
              <div className="flex flex-col items-center pt-1">
                <div
                  className={`rounded-full p-2 transition-colors ${
                    isCompleted || isCurrent
                      ? 'bg-success text-success-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step.icon}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-0.5 h-12 mt-2 ${
                      isCompleted || isCurrent ? 'bg-success' : 'bg-border'
                    }`}
                  />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 pt-2">
                <div className="flex items-center gap-2 mb-1">
                  <p
                    className={`text-sm font-medium ${
                      isCompleted || isCurrent
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </p>
                  {isCurrent && (
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-primary/15 text-primary rounded-full">
                      Current
                    </span>
                  )}
                  {isCompleted && (
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-success/15 text-success rounded-full">
                      Completed
                    </span>
                  )}
                </div>

                {/* Status Details */}
                {isCurrent && (
                  <p className="text-xs text-muted-foreground">
                    {rfq.status === 'new' && 'RFQ just received'}
                    {rfq.status === 'in_progress' && 'Supplier inquiries sent'}
                    {rfq.status === 'quoted' && 'Waiting for client confirmation'}
                    {order?.status === 'confirmed' && 'Client has confirmed the order'}
                    {order?.status === 'procurement' && 'Procurement in progress'}
                    {order?.status === 'installation' && 'Product is being installed'}
                    {order?.status === 'completed' && 'Installation complete, awaiting payment'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status Summary */}
      <div className="mt-6 pt-6 border-t border-border">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">RFQ Status</p>
            <p className="text-sm font-semibold text-foreground capitalize">{rfq.status.replace('_', ' ')}</p>
          </div>
          {order && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Order Status</p>
              <p className="text-sm font-semibold text-foreground capitalize">{order.status}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
