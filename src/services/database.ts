import { supabase } from "../../lib/supabase";
import type { Database } from "../types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Template = Database["public"]["Tables"]["templates"]["Row"];
export type ApiFragment = Database["public"]["Tables"]["api_fragments"]["Row"];

export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
export type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ApiFragmentInsert =
  Database["public"]["Tables"]["api_fragments"]["Insert"];

// Profile operations
export const profileService = {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch profile: ${error.message}`);
    }

    return data;
  },

  async createProfile(profile: ProfileInsert): Promise<Profile> {
    const { data, error } = await supabase
      .from("profiles")
      .insert(profile)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create profile: ${error.message}`);
    }

    return data;
  },

  async updateProfile(
    userId: string,
    updates: Partial<Profile>,
  ): Promise<Profile> {
    // Map name field to full_name for database compatibility
    const dbUpdates = { ...updates };
    if ("name" in updates) {
      // @ts-ignore - We know this is safe since we're mapping the field
      dbUpdates.full_name = updates.name;
      // @ts-ignore - Remove the name field since it doesn't exist in the database
      delete dbUpdates.name;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(dbUpdates)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    return data;
  },
};

// Project operations
export const projectService = {
  async getProjects(userId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }

    return data || [];
  },

  async getProject(projectId: string, userId: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch project: ${error.message}`);
    }

    return data;
  },

  async createProject(project: ProjectInsert): Promise<Project> {
    const { data, error } = await supabase
      .from("projects")
      .insert(project)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }

    return data;
  },

  async updateProject(
    projectId: string,
    userId: string,
    updates: Partial<Project>,
  ): Promise<Project> {
    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", projectId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }

    return data;
  },

  async deleteProject(projectId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  },

  async getProjectsByStatus(
    userId: string,
    status: string,
  ): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch projects by status: ${error.message}`);
    }

    return data || [];
  },
};

// Job operations
export const jobService = {
  async getJobs(userId: string): Promise<Job[]> {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch jobs: ${error.message}`);
    }

    return data || [];
  },

  async getJob(jobId: string, userId: string): Promise<Job | null> {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch job: ${error.message}`);
    }

    return data;
  },

  async createJob(job: JobInsert): Promise<Job> {
    const { data, error } = await supabase
      .from("jobs")
      .insert(job)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create job: ${error.message}`);
    }

    return data;
  },

  async updateJob(
    jobId: string,
    userId: string,
    updates: Partial<Job>,
  ): Promise<Job> {
    const { data, error } = await supabase
      .from("jobs")
      .update(updates)
      .eq("id", jobId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update job: ${error.message}`);
    }

    return data;
  },

  async getJobsByProject(projectId: string, userId: string): Promise<Job[]> {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch jobs by project: ${error.message}`);
    }

    return data || [];
  },

  async getJobsByStatus(userId: string, status: string): Promise<Job[]> {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_id", userId)
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch jobs by status: ${error.message}`);
    }

    return data || [];
  },
};

// Template operations
export const templateService = {
  async getTemplates(): Promise<Template[]> {
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }

    return data || [];
  },

  async getTemplate(templateId: string): Promise<Template | null> {
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch template: ${error.message}`);
    }

    return data;
  },

  async getTemplatesByCategory(category: string): Promise<Template[]> {
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .eq("category", category)
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(
        `Failed to fetch templates by category: ${error.message}`,
      );
    }

    return data || [];
  },

  async searchTemplates(query: string): Promise<Template[]> {
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .eq("is_public", true)
      .or(
        `name.ilike.%${query}%,description.ilike.%${query}%,tags.cs.{${query}}`,
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to search templates: ${error.message}`);
    }

    return data || [];
  },
};

// API Fragment operations
export const apiFragmentService = {
  create: async (fragment: ApiFragmentInsert) => {
    const { data, error } = await supabase
      .from("api_fragments")
      .insert(fragment)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("api_fragments")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  getByJobId: async (jobId: string) => {
    const { data, error } = await supabase
      .from("api_fragments")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: Partial<ApiFragment>) => {
    const { data, error } = await supabase
      .from("api_fragments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  delete: async (id: string, userId: string) => {
    // First fetch the fragment with its related job to verify ownership
    const { data: fragment, error: fetchError } = await supabase
      .from("api_fragments")
      .select(
        `
        id,
        job_id,
        jobs!inner(
          id,
          user_id
        )
      `,
      )
      .eq("id", id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        throw new Error("Fragment not found");
      }
      throw new Error(`Failed to fetch fragment: ${fetchError.message}`);
    }

    // Verify ownership through the job relationship
    if (!fragment.jobs || fragment.jobs[0]?.user_id !== userId) {
      throw new Error("Not authorized to delete this fragment");
    }

    // Perform the delete operation
    const { error: deleteError } = await supabase
      .from("api_fragments")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw new Error(`Failed to delete fragment: ${deleteError.message}`);
    }
  },
};

// Real-time subscriptions
export const subscriptionService = {
  subscribeToJobUpdates(userId: string, callback: (job: Job) => void) {
    return supabase
      .channel(`jobs:user_id=eq.${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jobs",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            callback(payload.new as Job);
          }
        },
      )
      .subscribe();
  },

  subscribeToProjectUpdates(
    userId: string,
    callback: (project: Project) => void,
  ) {
    return supabase
      .channel(`projects:user_id=eq.${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            callback(payload.new as Project);
          }
        },
      )
      .subscribe();
  },

  unsubscribe(subscription: any) {
    return supabase.removeChannel(subscription);
  },
};
