export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      room_channels: {
        Row: {
          id: string;
          room_id: string;
          name: string;
          slug: string;
          description: string | null;
          kind: "general" | "announcement" | "topic";
          position: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          name: string;
          slug: string;
          description?: string | null;
          kind?: "general" | "announcement" | "topic";
          position?: number;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["room_channels"]["Insert"]>;
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          public_key: string;
          encrypted_private_key: string | null;
          last_seen_at: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          avatar_url?: string | null;
          public_key: string;
          encrypted_private_key?: string | null;
          last_seen_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      rooms: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          is_public: boolean;
          owner_id: string;
          current_room_key_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          is_public?: boolean;
          owner_id: string;
          current_room_key_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rooms"]["Insert"]>;
      };
      room_members: {
        Row: {
          room_id: string;
          user_id: string;
          role: "admin" | "member";
          encrypted_room_key: string;
          current_room_key_id: string;
          joined_at: string;
        };
        Insert: {
          room_id: string;
          user_id: string;
          role?: "admin" | "member";
          encrypted_room_key: string;
          current_room_key_id: string;
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["room_members"]["Insert"]>;
      };
      room_keys: {
        Row: {
          id: string;
          room_id: string;
          version: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          version: number;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["room_keys"]["Insert"]>;
      };
      room_member_keys: {
        Row: {
          room_key_id: string;
          room_id: string;
          user_id: string;
          encrypted_room_key: string;
          created_at: string;
        };
        Insert: {
          room_key_id: string;
          room_id: string;
          user_id: string;
          encrypted_room_key: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["room_member_keys"]["Insert"]>;
      };
      messages: {
        Row: {
          id: string;
          room_id: string;
          channel_id: string | null;
          room_key_id: string;
          user_id: string;
          ciphertext: string;
          iv: string;
          type: "text" | "file" | "system";
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          channel_id: string;
          room_key_id: string;
          user_id: string;
          ciphertext: string;
          iv: string;
          type?: "text" | "file" | "system";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
      };
      files: {
        Row: {
          id: string;
          message_id: string;
          room_id: string;
          channel_id: string | null;
          storage_path: string;
          encrypted: boolean;
          iv: string;
          size: number;
          type: string;
          name: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          room_id: string;
          channel_id?: string | null;
          storage_path: string;
          encrypted?: boolean;
          iv: string;
          size: number;
          type: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["files"]["Insert"]>;
      };
      reactions: {
        Row: {
          message_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reactions"]["Insert"]>;
      };
      message_reads: {
        Row: {
          message_id: string;
          user_id: string;
          read_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
          read_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["message_reads"]["Insert"]>;
      };
      room_invites: {
        Row: {
          id: string;
          room_id: string;
          token: string;
          created_by: string;
          expires_at: string;
          max_uses: number;
          uses: number;
          key_wrap_ciphertext: string | null;
          key_wrap_iv: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          token: string;
          created_by: string;
          expires_at: string;
          max_uses?: number;
          uses?: number;
          key_wrap_ciphertext?: string | null;
          key_wrap_iv?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["room_invites"]["Insert"]>;
      };
    };
  };
}
