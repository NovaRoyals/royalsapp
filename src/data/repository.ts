import {
  demoAnnouncements,
  demoCompetitions,
  demoPrograms,
  demoSchedule,
  demoTeams,
} from '@/data/demo';
import { isDemoMode, supabase } from '@/lib/supabase';
import type { Announcement, Competition, Program, ScheduleEvent, Team } from '@/types/domain';

export interface RoyalsRepository {
  getPrograms(): Promise<Program[]>;
  getTeams(): Promise<Team[]>;
  getSchedule(): Promise<ScheduleEvent[]>;
  getCompetitions(): Promise<Competition[]>;
  getAnnouncements(): Promise<Announcement[]>;
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class DemoRoyalsRepository implements RoyalsRepository {
  async getPrograms() {
    await delay(180);
    return demoPrograms;
  }
  async getTeams() {
    await delay(150);
    return demoTeams;
  }
  async getSchedule() {
    await delay(140);
    return demoSchedule;
  }
  async getCompetitions() {
    await delay(130);
    return demoCompetitions;
  }
  async getAnnouncements() {
    await delay(120);
    return demoAnnouncements;
  }
}

class SupabaseRoyalsRepository implements RoyalsRepository {
  private client = supabase!;

  async getPrograms() {
    const { data, error } = await this.client
      .from('programs')
      .select('*, sports!inner(code), program_sessions(count)')
      .eq('is_published', true)
      .order('registration_opens_at', { ascending: false });
    if (error) throw error;
    return data as unknown as Program[];
  }

  async getTeams() {
    const { data, error } = await this.client.from('teams').select('*, sports!inner(code), competitions(title)');
    if (error) throw error;
    return data as unknown as Team[];
  }

  async getSchedule() {
    const { data, error } = await this.client
      .from('events')
      .select('*, sports!inner(code), teams(name), competitions(title)')
      .order('starts_at');
    if (error) throw error;
    return data as unknown as ScheduleEvent[];
  }

  async getCompetitions() {
    const { data, error } = await this.client.from('competitions').select('*, sports!inner(code), divisions(*)');
    if (error) throw error;
    return data as unknown as Competition[];
  }

  async getAnnouncements() {
    const { data, error } = await this.client
      .from('announcements')
      .select('*')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false });
    if (error) throw error;
    return data as unknown as Announcement[];
  }
}

export const repository: RoyalsRepository = isDemoMode
  ? new DemoRoyalsRepository()
  : new SupabaseRoyalsRepository();
