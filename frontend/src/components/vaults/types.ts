export type CategoryPriority = "must-have" | "good-to-have" | "optional";

export type CategoryConfig = {
  id: string;
  name: string;
  priority: CategoryPriority;
  microcopy: string;
};

