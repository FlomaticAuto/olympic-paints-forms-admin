CREATE TABLE public.store_visit_captures (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_ref                text NOT NULL,
  store_name                text NOT NULL,
  store_address             text,
  visit_date                date NOT NULL,
  merchandiser              text NOT NULL,

  checked_stock_location    boolean,
  checked_fifo              boolean,
  stock_on_floor_sufficient boolean,
  replenishment_order_placed boolean,
  rep_servicing_store       text,

  floor_vinyls              integer,
  vertical_colour_chart     integer,
  horizontal_colour_chart   integer,
  shelf_wobblers            integer,
  big_colour_chart          integer,
  pricing_boards            integer,
  other_merch_items         text,

  all_colour_charts_in_place boolean,

  photo_store_front         text,
  photo_stock_before        text,
  photo_stock_after         text,
  photo_chart_before        text,
  photo_chart_after         text,

  spoke_to                  text,
  customer_survey_completed boolean,
  rating_service_delivery   text CHECK (rating_service_delivery   IN ('Not Satisfied','Somewhat Satisfied','Satisfied')),
  rating_communication      text CHECK (rating_communication      IN ('Not Satisfied','Somewhat Satisfied','Satisfied')),
  rating_rep_service        text CHECK (rating_rep_service        IN ('Not Satisfied','Somewhat Satisfied','Satisfied')),
  rating_paperwork          text CHECK (rating_paperwork          IN ('Not Satisfied','Somewhat Satisfied','Satisfied')),
  rating_logistics          text CHECK (rating_logistics          IN ('Not Satisfied','Somewhat Satisfied','Satisfied')),
  customer_comments         text,
  customer_feedback_reason  text,
  overall_store_condition   text CHECK (overall_store_condition   IN ('Poor','Fair','Good','Excellent')),

  checked_in_at             timestamptz,
  checked_out_at            timestamptz,
  gazebo_day_feedback       text,

  submitted_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_svc_report_ref   ON public.store_visit_captures (report_ref);
CREATE INDEX idx_svc_visit_date   ON public.store_visit_captures (visit_date);
CREATE INDEX idx_svc_merchandiser ON public.store_visit_captures (merchandiser);
