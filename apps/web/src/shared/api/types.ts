export type Totals = {
  visitors: number;
  visitors_all: number;
  pageviews: number;
  bot_pageviews?: number;
  requests?: number;
  returning?: number;
};

export type HourlyRow = {
  hour: string;
  label: string;
  visitors: number;
  pageviews: number;
};

export type NamedViews = {
  path?: string;
  referer?: string;
  views: number;
  others?: boolean;
  others_count?: number;
};

export type DayPayload = {
  day: string;
  is_today: boolean;
  timezone: string;
  day_window: string;
  since: string;
  available_days: string[];
  totals: Totals;
  hourly: HourlyRow[];
  top_pages: NamedViews[];
  top_referers: NamedViews[];
};

export type OverviewPayload = {
  generated: string;
  generated_epoch: number;
  timezone: string;
  day_window: string;
  since: string;
  today: string;
  selected_day: string;
  available_days: string[];
  totals: {
    today: Totals;
    yesterday: Totals;
    last7: Totals;
    last30: Totals;
    all: Totals;
    returning_today: number;
  };
  daily: Array<{
    day: string;
    visitors: number;
    pageviews: number;
    visitors_all: number;
  }>;
  hourly: HourlyRow[];
  day: DayPayload;
  top_pages: NamedViews[];
  top_referers: NamedViews[];
};

export type TopListPayload = {
  kind: "pages" | "refs";
  title: string;
  name_key: "path" | "referer";
  day: string;
  is_today: boolean;
  timezone: string;
  available_days: string[];
  count: number;
  total_views: number;
  rows: NamedViews[];
};
