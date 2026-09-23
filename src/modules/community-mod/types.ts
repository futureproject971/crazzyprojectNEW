export type CommunityModMessage = {
  id:string;
  userId:string;
  body:string|null;
  deleted:boolean;
  deletedAt:string|null;
  editedAt:string|null;
  createdAt:string;
  channel:{slug:string;name:string};
  author:{
    username:string|null;
    avatarUrl:string|null;
    banned:boolean;
    bannedAt:string|null;
    bannedReason:string|null;
    discordUserId:string|null;
    discordUsername:string|null;
    guildMember:boolean;
    roles:string[];
  };
};
export type CommunityModAction = {
  id:string;
  actor_user_id:string;
  target_user_id:string|null;
  message_id:string|null;
  action:"delete_message"|"ban_user"|"unban_user";
  reason:string;
  created_at:string;
};
export type CommunityModPayload = {
  messages:CommunityModMessage[];
  actions:CommunityModAction[];
  viewer:{userId:string;roles:string[]};
};
