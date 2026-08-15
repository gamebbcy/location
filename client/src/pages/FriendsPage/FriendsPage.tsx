import { useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Copy,
  Link2,
  MessageCircle,
  Send,
  Home,
  Building2,
  GraduationCap,
  MapPin,
  Pencil,
  Plus,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { useFriends, type Friend } from '@client/src/hooks/useFriends';
import { usePlaces, type Place } from '@client/src/hooks/usePlaces';
import { FriendRow } from './FriendRow';
import { DeleteFriendDialog } from './DeleteFriendDialog';
import { PlaceDialog } from './PlaceDialog';
import { generateInviteLink, shareInvite } from '@client/src/lib/utils/invite';
import { getProfile } from '@client/src/lib/storage';

const TAG_ICON_MAP = {
  home: Home,
  company: Building2,
  school: GraduationCap,
  other: MapPin,
} as const;

const TAG_LABEL_MAP = {
  home: '家',
  company: '公司',
  school: '学校',
  other: '其他',
} as const;

const FriendsPage = () => {
  const navigate = useNavigate();
  const {
    friends,
    onlineFriends,
    offlineFriends,
    myInviteCode,
    addFriend,
    removeFriend,
  } = useFriends();
  const { places, addPlace, updatePlace, deletePlace } = usePlaces();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Friend | null>(null);
  const [placeDialogOpen, setPlaceDialogOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(myInviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    } catch (err) {
      logger.error('copy invite code failed', err);
    }
  };

  const handleCopyLink = async () => {
    try {
      const link = generateInviteLink(myInviteCode);
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    } catch (err) {
      logger.error('copy invite link failed', err);
    }
  };

  const handleShare = async () => {
    try {
      const profile = getProfile();
      const nickname = profile?.nickname || '好友';
      await shareInvite(myInviteCode, nickname);
    } catch (err) {
      logger.error('share invite failed', err);
    }
  };

  const handleLongPressFriend = (friend: Friend) => {
    setDeleteTarget(friend);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await removeFriend(deleteTarget.userId);
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleEditPlace = (place: Place) => {
    setEditingPlace(place);
    setPlaceDialogOpen(true);
  };

  const handleAddPlace = () => {
    setEditingPlace(null);
    setPlaceDialogOpen(true);
  };

  const handleSavePlace = (data: Omit<Place, 'id'>) => {
    if (editingPlace) {
      updatePlace(editingPlace.id, data);
    } else {
      addPlace(data);
    }
    setPlaceDialogOpen(false);
  };

  const handleDeletePlace = (id: string) => {
    deletePlace(id);
    setPlaceDialogOpen(false);
    setEditingPlace(null);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-md mx-auto px-4 pt-6 pb-4">
        <h1 className="text-xl font-semibold text-foreground">好友</h1>
      </div>

      {/* 添加好友卡片（渐变背景） */}
      <div className="max-w-md mx-auto px-4 mb-4">
        <div
          className="rounded-xl p-5 shadow-sm text-white overflow-hidden relative"
          style={{
            background:
              'linear-gradient(135deg, hsl(168 65% 42%) 0%, hsl(172 60% 50%) 60%, hsl(180 55% 58%) 100%)',
          }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="w-4 h-4" />
              <span className="text-sm font-medium">添加好友</span>
            </div>
            <p className="text-xs opacity-80 mb-4">分享邀请码，和好友共享位置</p>

            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-4">
              <div className="text-xs opacity-80 mb-1">我的邀请码</div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold tracking-widest font-mono">
                  {myInviteCode}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/25 hover:bg-white/35 text-white border-0 h-8"
                  onClick={handleCopyCode}
                >
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  {copiedCode ? '已复制' : '复制'}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="secondary"
                size="icon"
                className="flex-1 h-10 bg-white/20 hover:bg-white/30 text-white border-0 rounded-xl"
                onClick={handleShare}
                title="QQ"
              >
                <Send className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="flex-1 h-10 bg-white/20 hover:bg-white/30 text-white border-0 rounded-xl"
                onClick={handleShare}
                title="微信"
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="flex-1 h-10 bg-white/20 hover:bg-white/30 text-white border-0 rounded-xl"
                onClick={handleCopyLink}
                title="复制链接"
              >
                <Link2 className="w-4 h-4" />
              </Button>
            </div>

            <Button
              className="w-full bg-white text-primary hover:bg-white/90 font-medium"
              onClick={() => navigate('/add-friend')}
            >
              <UserPlus className="w-4 h-4 mr-1" />
              添加好友
            </Button>

            {copiedLink && (
              <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                链接已复制
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 好友列表 */}
      <div className="max-w-md mx-auto px-4 mb-6">
        {onlineFriends.length > 0 && (
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden mb-4">
            <div className="px-4 py-2 bg-accent/30 text-xs font-medium text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" style={{ animationDuration: '2s' }} />
              在线好友 · {onlineFriends.length}
            </div>
            {onlineFriends.map((f: Friend) => (
              <div key={f.userId} className="border-t border-border first:border-t-0">
                <FriendRow friend={f} onLongPress={handleLongPressFriend} />
              </div>
            ))}
          </div>
        )}

        {offlineFriends.length > 0 && (
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="px-4 py-2 bg-accent/30 text-xs font-medium text-muted-foreground">
              离线好友 · {offlineFriends.length}
            </div>
            {offlineFriends.map((f: Friend) => (
              <div key={f.userId} className="border-t border-border first:border-t-0">
                <FriendRow friend={f} onLongPress={handleLongPressFriend} />
              </div>
            ))}
          </div>
        )}

        {friends.length === 0 && (
          <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">还没有好友，快去添加吧~</p>
          </div>
        )}
      </div>

      {/* 常用地点 */}
      <div className="max-w-md mx-auto px-4 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">常用地点</h2>
        </div>
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          {places.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">还没有添加常用地点</p>
            </div>
          ) : (
            places.map((place: Place, idx: number) => {
              const TagIcon = TAG_ICON_MAP[place.tag] || MapPin;
              return (
                <div
                  key={place.id}
                  className={`flex items-center gap-3 p-4 ${
                    idx > 0 ? 'border-t border-border' : ''
                  }`}
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <TagIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{place.name}</span>
                      <Badge variant="secondary" className="text-xs rounded-full">
                        {TAG_LABEL_MAP[place.tag]}
                      </Badge>
                    </div>
                    {place.address && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {place.address}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground shrink-0"
                    onClick={() => handleEditPlace(place)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              );
            })
          )}
          <div className="p-3 border-t border-border">
            <Button variant="outline" size="sm" className="w-full" onClick={handleAddPlace}>
              <Plus className="w-4 h-4 mr-1" />
              添加新地点
            </Button>
          </div>
        </div>
      </div>

      <DeleteFriendDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        friendName={deleteTarget?.nickname || ''}
        onConfirm={handleConfirmDelete}
      />
      <PlaceDialog
        open={placeDialogOpen}
        onOpenChange={setPlaceDialogOpen}
        place={editingPlace}
        onSave={handleSavePlace}
        onDelete={handleDeletePlace}
      />
    </div>
  );
};

export default FriendsPage;
