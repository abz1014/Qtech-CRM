// ─── Built-in Follow-up Sequences ────────────────────────────────────────────
// Sequences are multi-step follow-up chains applied to an entity in one click.
// Each step gets its own due date calculated from today + daysFromNow.

export interface SequenceStep {
  title: string;
  action_type: string;
  daysFromNow: number;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
}

export interface Sequence {
  id: string;
  name: string;
  description: string;
  icon: string;
  applicableTo: string[]; // entity types this sequence makes sense for
  steps: SequenceStep[];
}

export const SEQUENCES: Sequence[] = [
  {
    id: 'new_prospect',
    name: 'New Prospect Cadence',
    description: '4-step outreach sequence for new prospects over 2 weeks',
    icon: '🎯',
    applicableTo: ['prospect', 'client'],
    steps: [
      {
        title: 'Initial outreach call',
        action_type: 'rfq_followup',
        daysFromNow: 0,
        priority: 'high',
        notes: 'First contact — introduce Q Tech Solutions and understand their needs',
      },
      {
        title: 'Follow-up email / WhatsApp',
        action_type: 'rfq_followup',
        daysFromNow: 3,
        priority: 'medium',
        notes: 'Send company profile and product catalogue if not already done',
      },
      {
        title: 'Check-in call',
        action_type: 'rfq_followup',
        daysFromNow: 7,
        priority: 'medium',
        notes: 'Ask if they have any upcoming requirements or active RFQs',
      },
      {
        title: 'Final outreach — decision',
        action_type: 'rfq_followup',
        daysFromNow: 14,
        priority: 'low',
        notes: 'Last attempt — ask if we can stay in touch for future requirements',
      },
    ],
  },
  {
    id: 'rfq_to_order',
    name: 'RFQ to Order Cadence',
    description: 'Complete sequence from receiving RFQ to converting to order',
    icon: '📋',
    applicableTo: ['rfq'],
    steps: [
      {
        title: 'Float RFQ to suppliers for pricing',
        action_type: 'supplier_response',
        daysFromNow: 0,
        priority: 'high',
        notes: 'Send inquiry to at least 2-3 suppliers',
      },
      {
        title: 'Chase supplier responses',
        action_type: 'supplier_response',
        daysFromNow: 2,
        priority: 'high',
        notes: 'Follow up with any supplier who has not responded',
      },
      {
        title: 'Send quote to client',
        action_type: 'rfq_followup',
        daysFromNow: 4,
        priority: 'high',
        notes: 'Prepare and send competitive quote with lead time and terms',
      },
      {
        title: 'Client decision follow-up',
        action_type: 'rfq_followup',
        daysFromNow: 7,
        priority: 'medium',
        notes: 'Check if client has reviewed the quote — address any concerns',
      },
      {
        title: 'Final push — close or lose',
        action_type: 'rfq_followup',
        daysFromNow: 12,
        priority: 'medium',
        notes: 'If still no decision, offer validity extension or ask for feedback',
      },
    ],
  },
  {
    id: 'order_delivery',
    name: 'Order Delivery Cadence',
    description: 'Track an order from placement through delivery and payment',
    icon: '📦',
    applicableTo: ['order'],
    steps: [
      {
        title: 'Confirm PO sent to vendor',
        action_type: 'order_status',
        daysFromNow: 0,
        priority: 'high',
        notes: 'Confirm vendor received the PO and acknowledged lead time',
      },
      {
        title: 'Vendor shipment status check',
        action_type: 'order_status',
        daysFromNow: 7,
        priority: 'medium',
        notes: 'Get shipping/dispatch update from vendor',
      },
      {
        title: 'Confirm delivery to client',
        action_type: 'order_status',
        daysFromNow: 14,
        priority: 'medium',
        notes: 'Confirm equipment received and client is satisfied',
      },
      {
        title: 'Payment follow-up',
        action_type: 'overdue_invoice',
        daysFromNow: 21,
        priority: 'high',
        notes: 'Check if payment has been processed or is due soon',
      },
    ],
  },
  {
    id: 'client_relationship',
    name: 'Client Relationship Cadence',
    description: 'Regular touchpoints to keep existing clients warm',
    icon: '🤝',
    applicableTo: ['client'],
    steps: [
      {
        title: 'Monthly check-in call',
        action_type: 'rfq_followup',
        daysFromNow: 0,
        priority: 'medium',
        notes: 'Ask about upcoming projects, new equipment needs, or any issues',
      },
      {
        title: 'Share product update / new offering',
        action_type: 'rfq_followup',
        daysFromNow: 14,
        priority: 'low',
        notes: 'Send relevant product info or new supplier partnerships',
      },
      {
        title: 'Follow-up on any shared leads',
        action_type: 'rfq_followup',
        daysFromNow: 30,
        priority: 'medium',
        notes: 'Check if any previous discussions led to a requirement',
      },
    ],
  },
];

export function getSequencesForEntity(entityType: string): Sequence[] {
  return SEQUENCES.filter(s => s.applicableTo.includes(entityType));
}
