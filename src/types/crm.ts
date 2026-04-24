export type UserRole = 'admin' | 'sales' | 'engineer';

export type ProspectStatus = 'hot' | 'warm' | 'cold';

export type OrderStatus = 'quotation' | 'confirmed' | 'procurement' | 'installation' | 'completed';

export type ProductType = 'DVR' | 'SVG' | 'AHF' | 'Automation' | 'Software';

export type CommissioningStatus = 'pending' | 'in_progress' | 'completed';

export type RFQStatus = 'new' | 'in_progress' | 'quoted' | 'lost' | 'converted';

export type RFQPriority = 'high' | 'medium' | 'low';

export type SupplierInquiryStatus = 'pending' | 'responded' | 'no_response';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Client {
  id: string;
  company_name: string;
  industry: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  created_by: string;
}

export interface Prospect {
  id: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  lead_source: string;
  status: ProspectStatus;
  follow_up_date: string;
  assigned_to: string;
  converted_client_id: string | null;
}

export interface Vendor {
  id: string;
  name: string;
  country: string;
  contact_person: string;
  phone: string;
  email: string;
  products_supplied: string;
}

export interface Order {
  id: string;
  client_id: string;
  vendor_id: string;
  sales_person_id: string;
  product_type: ProductType | string;
  order_value: number;
  cost_value: number;
  status: OrderStatus;
  notes: string;
  confirmed_date: string | null;
  rfq_id: string | null;
}

export interface OrderEngineer {
  id: string;
  order_id: string;
  engineer_id: string;
  site_location: string;
  start_date: string;
  expected_completion: string;
  commissioning_status: CommissioningStatus;
}

export interface RFQ {
  id: string;
  client_id: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  rfq_date: string;
  estimated_value: number;
  assigned_to: string;
  priority: RFQPriority;
  status: RFQStatus;
  notes: string;
  converted_order_id: string | null;
}

export interface RFQLineItem {
  id: string;
  rfq_id: string;
  product_type: string;
  quantity: number;
  specification: string;
  target_price: number | null;
}

export interface SupplierInquiry {
  id: string;
  rfq_id: string;
  vendor_id: string;
  sent_at: string;
  status: SupplierInquiryStatus;
  email_draft: string;
  follow_up_date: string | null;
}

export interface SupplierQuote {
  id: string;
  rfq_id: string;
  vendor_id: string;
  inquiry_id: string | null;
  received_at: string;
  unit_price: number;
  currency: string;
  lead_time_days: number;
  moq: number;
  validity_days: number;
  notes: string;
  is_selected: boolean;
}
