export type ServiceState =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage"
  | "maintenance";

export type IncidentState = "investigating" | "identified" | "monitoring" | "resolved";
export type IncidentImpact = "none" | "minor" | "major" | "critical";

export type StatusComponent = {
  key: string;
  label: string;
  description: string;
  state: ServiceState;
  message: string | null;
  updated_at: string;
};

export type StatusIncidentUpdate = {
  state: IncidentState;
  message: string;
  created_at: string;
};

export type StatusIncident = {
  id: string;
  title: string;
  state: IncidentState;
  impact: IncidentImpact;
  message: string;
  started_at: string;
  resolved_at: string | null;
  updated_at: string;
  components: Array<{ key: string; label: string }>;
  updates: StatusIncidentUpdate[];
};

export type PublicStatusSnapshot = {
  components: StatusComponent[];
  incidents: StatusIncident[];
  generated_at: string;
};
