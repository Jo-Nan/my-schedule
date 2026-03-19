import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { upload } from '@vercel/blob/client';
import {
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

const COLOR_PALETTE = [
  '#f97316',
  '#3b82f6',
  '#10b981',
  '#eab308',
  '#ef4444',
  '#14b8a6',
  '#8b5cf6',
  '#ec4899',
  '#84cc16',
  '#06b6d4',
];

const CHINA_VIEW = {
  center: [30.5, 104.2],
  zoom: 4,
  minZoom: 3,
};

const CHINA_BOUNDS = [
  [3.5, 73.5],
  [53.6, 134.8],
];

const WORLD_VIEW = {
  center: [20, 0],
  zoom: 2,
  minZoom: 2,
};

const WORLD_BOUNDS = [
  [-85, -180],
  [85, 180],
];

const FEATURED_BUBBLE_ANCHOR_ICON = divIcon({
  className: 'map-featured-bubble-anchor',
  html: '<span></span>',
  iconSize: [1, 1],
  iconAnchor: [0, 0],
});

const MAP_DB_NAME = 'nanmuz_map_workspace_db';
const MAP_DB_VERSION = 1;
const MAP_DB_STORE = 'workspace';

const MAX_UPLOAD_FILE_MB = 12;
const MAX_CANVAS_EDGE = 1920;
const MAX_THUMBNAIL_EDGE = 560;
const MAX_PHOTO_COUNT_PER_POINT = 24;
const MAP_AUTO_UPLOAD_DELAY_MS = 1200;
const RECYCLE_BIN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PLACE_HISTORY = 12;
const MAX_FAVORITE_PLACES = 16;

const openMapDatabase = () => new Promise((resolve, reject) => {
  if (typeof window === 'undefined' || !window.indexedDB) {
    resolve(null);
    return;
  }

  const request = window.indexedDB.open(MAP_DB_NAME, MAP_DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(MAP_DB_STORE)) {
      database.createObjectStore(MAP_DB_STORE);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
});

const readWorkspaceFromDb = async (storageKey) => {
  const database = await openMapDatabase();
  if (!database) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(MAP_DB_STORE, 'readonly');
    const store = transaction.objectStore(MAP_DB_STORE);
    const request = store.get(storageKey);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('IndexedDB read failed'));
  });
};

const writeWorkspaceToDb = async (storageKey, payload) => {
  const database = await openMapDatabase();
  if (!database) {
    throw new Error('IndexedDB unavailable');
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(MAP_DB_STORE, 'readwrite');
    const store = transaction.objectStore(MAP_DB_STORE);
    const request = store.put(payload, storageKey);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('IndexedDB write failed'));
  });
};

const TEXTS = {
  en: {
    title: 'Map Workspace',
    subtitle: 'Manage people, pin locations, and keep route/photo bookmarks.',
    chinaScope: 'China',
    worldScope: 'World',
    backToSchedule: 'Back to schedule',
    legendTitle: 'Users',
    legendHint: 'Pick a user to view/edit their points.',
    userEditBtn: 'Edit user',
    userPlacesTitle: 'User places',
    placeEditBtn: 'Edit',
    placeDeleteBtn: 'Delete',
    noUserPlaces: 'No places under this user.',
    addUserTitle: 'Add User',
    editUserTitle: 'Edit Selected User',
    addUserName: 'Username',
    addUserNamePlaceholder: 'e.g. Alice',
    editUserNamePlaceholder: 'Rename selected user',
    colorHexLabel: 'Color block',
    colorRgbLabel: 'RGB',
    addUserBtn: 'Add user',
    renameUserBtn: 'Rename',
    updateUserBtn: 'Save user',
    deleteUserBtn: 'Delete user',
    cityTitle: 'City / Coordinates',
    cityInputLabel: 'Search city',
    cityInputPlaceholder: 'e.g. Shanghai, London, Tokyo',
    citySearchBtn: 'Search',
    citySearching: 'Searching...',
    localMatchTitle: 'Local matches',
    favoritePlacesTitle: 'Favorites',
    searchHistoryTitle: 'Recent searches',
    addFavoriteBtn: 'Favorite',
    removeFavoriteBtn: 'Unfavorite',
    saveCurrentPlaceBtn: 'Save current place',
    noFavoritePlaces: 'No favorites yet.',
    noSearchHistory: 'No recent searches.',
    sharePanelTitle: 'Share',
    shareManageBtn: 'Share link',
    shareCloseBtn: 'Close',
    shareEnableBtn: 'Enable read-only link',
    shareDisableBtn: 'Disable link',
    shareRegenerateBtn: 'Regenerate link',
    shareCopyBtn: 'Copy link',
    shareLinkLabel: 'Share URL',
    shareBusyLabel: 'Updating...',
    shareReadyHint: 'Anyone with this link can view the map in read-only mode.',
    shareNotEnabledHint: 'Read-only link is disabled.',
    shareCopied: 'Share link copied.',
    shareCopyFailed: 'Failed to copy link.',
    shareDisableConfirm: 'Disable read-only link now?',
    shareRegenerateConfirm: 'Regenerate share link now? Old link will stop working.',
    readOnlyBanner: 'Read-only shared view',
    placeLabel: 'Place label',
    placePlaceholder: 'Can be city, scenic spot, or custom note',
    latitudeLabel: 'Latitude',
    longitudeLabel: 'Longitude',
    routeLabel: 'Optional route note',
    routePlaceholder: 'Metro line, meeting route, driving plan, etc.',
    addPointSaving: 'Creating...',
    addPointBtn: 'Add map point',
    markersTitle: 'Current Markers',
    markersEmpty: 'No points yet. Add the first one from the panel above.',
    noRoute: 'No route note.',
    bookmarkTitle: 'Bookmark',
    ownerLabel: 'User',
    coordinateLabel: 'Coordinates',
    photosTitle: 'Photos',
    noPhotos: 'No photos uploaded.',
    uploadPhotosLabel: 'Upload photos',
    uploadingLabel: 'Uploading...',
    uploadFailedLabel: 'Upload failed',
    retryUploadBtn: 'Retry',
    retryAllFailedBtn: 'Retry all failed',
    uploadQueueTitle: 'Upload queue',
    setFeaturedBtn: 'Set featured',
    clearFeaturedBtn: 'Featured: None',
    featuredBubbleShow: 'Show featured bubbles',
    featuredBubbleHide: 'Hide featured bubbles',
    featuredLayoutLabel: 'Bubble layout',
    featuredLayoutMap: 'Near pin',
    featuredLayoutRight: 'Right dock',
    featuredLayoutBottom: 'Bottom dock',
    featuredPhotoAlt: 'Featured photo',
    featuredBadge: 'Featured',
    openBookmarkBtn: 'Open bookmark editor',
    closeEditorBtn: 'Close editor',
    editorTitle: 'Bookmark Editor',
    removePhotoBtn: 'Remove',
    previewPhotoBtn: 'Zoom',
    closePreviewBtn: 'Close',
    prevPhotoBtn: 'Prev',
    nextPhotoBtn: 'Next',
    removePointBtn: 'Remove point',
    photoReadError: 'Some images could not be loaded.',
    photoTooLargeError: `Some images were larger than ${MAX_UPLOAD_FILE_MB}MB and were skipped.`,
    photoCountLimitError: `At most ${MAX_PHOTO_COUNT_PER_POINT} photos can be stored for one point.`,
    storageLimitError: 'Storage limit reached. Reduce photos or clear old points.',
    conflictDetected: 'Map data changed on another device.',
    conflictLoadLatest: 'Load latest cloud version now?',
    conflictForceOverwrite: 'Force overwrite cloud data with current local changes?',
    conflictNoAction: 'Save paused due to version conflict.',
    conflictLoadedLatest: 'Loaded latest cloud version.',
    conflictOverwriteSuccess: 'Conflict resolved by overwrite.',
    geocodeError: 'Failed to search city. Try another keyword or enter coordinates manually.',
    noGeocodeResult: 'No city result found.',
    needUserName: 'Please enter a username first.',
    duplicateUserName: 'This username already exists.',
    needUserSelect: 'Please create/select a user first.',
    cannotDeleteLastUser: 'At least one user must be kept.',
    deleteUserConfirm: 'Delete this user?',
    userDeleteReassign: 'Points will be reassigned to',
    dangerSecondConfirm: 'This action cannot be undone. Please confirm again.',
    deletePointConfirm: 'Delete this map point?',
    deletePhotoConfirm: 'Delete this photo?',
    recycleBinTitle: 'Recycle bin',
    recycleBinHint: 'Deleted items can be restored within 7 days.',
    recycleBinEmpty: 'Recycle bin is empty.',
    recycleRestoreBtn: 'Restore',
    recycleDeleteBtn: 'Delete now',
    recycleDeletedAt: 'Deleted',
    recyclePointLabel: 'Point',
    recyclePhotoLabel: 'Photo',
    recycleUserLabel: 'User',
    invalidRgb: 'RGB must be in the format like 255, 120, 0.',
    invalidCoord: 'Please enter valid latitude/longitude.',
    invalidCoordRange: 'Latitude must be between -90 and 90, longitude between -180 and 180.',
    markerCountLabel: 'points',
    userPointsLabel: 'points',
  },
  zh: {
    title: '地图工作区',
    subtitle: '管理用户、标记地点，并保存路线与照片书签。',
    chinaScope: '中国地图',
    worldScope: '世界地图',
    backToSchedule: '返回日程',
    legendTitle: '用户',
    legendHint: '点击用户查看并管理名下地点。',
    userEditBtn: '编辑用户',
    userPlacesTitle: '用户地点',
    placeEditBtn: '编辑',
    placeDeleteBtn: '删除',
    noUserPlaces: '该用户下暂无地点。',
    addUserTitle: '添加用户',
    editUserTitle: '编辑当前用户',
    addUserName: '用户名',
    addUserNamePlaceholder: '例如：小李',
    editUserNamePlaceholder: '修改当前选中用户名',
    colorHexLabel: '色块选择',
    colorRgbLabel: 'RGB',
    addUserBtn: '添加用户',
    renameUserBtn: '修改用户名',
    updateUserBtn: '保存用户',
    deleteUserBtn: '删除用户',
    cityTitle: '城市 / 经纬度',
    cityInputLabel: '输入城市',
    cityInputPlaceholder: '例如：上海、北京、London',
    citySearchBtn: '搜索',
    citySearching: '搜索中...',
    localMatchTitle: '本地匹配',
    favoritePlacesTitle: '收藏地点',
    searchHistoryTitle: '最近搜索',
    addFavoriteBtn: '收藏',
    removeFavoriteBtn: '取消收藏',
    saveCurrentPlaceBtn: '收藏当前地点',
    noFavoritePlaces: '暂无收藏地点。',
    noSearchHistory: '暂无搜索记录。',
    sharePanelTitle: '分享',
    shareManageBtn: '分享链接',
    shareCloseBtn: '关闭',
    shareEnableBtn: '开启只读分享',
    shareDisableBtn: '关闭分享链接',
    shareRegenerateBtn: '重置分享链接',
    shareCopyBtn: '复制链接',
    shareLinkLabel: '分享链接',
    shareBusyLabel: '处理中...',
    shareReadyHint: '任何持有该链接的人都可只读查看地图。',
    shareNotEnabledHint: '只读分享未开启。',
    shareCopied: '分享链接已复制。',
    shareCopyFailed: '复制分享链接失败。',
    shareDisableConfirm: '确认关闭只读分享吗？',
    shareRegenerateConfirm: '确认重置分享链接吗？旧链接将失效。',
    readOnlyBanner: '只读分享视图',
    placeLabel: '地点名称',
    placePlaceholder: '可填城市、景点或自定义备注',
    latitudeLabel: '纬度',
    longitudeLabel: '经度',
    routeLabel: '路线备注（可选）',
    routePlaceholder: '地铁线路、会面路线、自驾方案等',
    addPointSaving: '创建中...',
    addPointBtn: '添加地图点位',
    markersTitle: '当前点位',
    markersEmpty: '还没有点位，先从上方添加第一个地点。',
    noRoute: '暂无路线备注。',
    bookmarkTitle: '书签详情',
    ownerLabel: '用户',
    coordinateLabel: '经纬度',
    photosTitle: '照片',
    noPhotos: '暂无上传照片。',
    uploadPhotosLabel: '上传照片',
    uploadingLabel: '上传中...',
    uploadFailedLabel: '上传失败',
    retryUploadBtn: '重试',
    retryAllFailedBtn: '重试全部失败',
    uploadQueueTitle: '上传队列',
    setFeaturedBtn: '设为精选',
    clearFeaturedBtn: '精选：无',
    featuredBubbleShow: '显示精选书签',
    featuredBubbleHide: '隐藏精选书签',
    featuredLayoutLabel: '书签布局',
    featuredLayoutMap: '点位旁边',
    featuredLayoutRight: '右侧停靠',
    featuredLayoutBottom: '下侧停靠',
    featuredPhotoAlt: '精选照片',
    featuredBadge: '精选',
    openBookmarkBtn: '打开书签编辑器',
    closeEditorBtn: '关闭编辑器',
    editorTitle: '书签编辑器',
    removePhotoBtn: '删除',
    previewPhotoBtn: '放大',
    closePreviewBtn: '关闭',
    prevPhotoBtn: '上一张',
    nextPhotoBtn: '下一张',
    removePointBtn: '删除点位',
    photoReadError: '部分图片读取失败，请重试。',
    photoTooLargeError: `部分图片超过 ${MAX_UPLOAD_FILE_MB}MB，已跳过。`,
    photoCountLimitError: `单个点位最多保存 ${MAX_PHOTO_COUNT_PER_POINT} 张图片。`,
    storageLimitError: '本地存储空间不足，请减少图片或清理旧点位。',
    conflictDetected: '地图数据已被其他设备修改。',
    conflictLoadLatest: '是否加载云端最新版本？',
    conflictForceOverwrite: '是否用当前本地修改强制覆盖云端？',
    conflictNoAction: '检测到版本冲突，已暂停保存。',
    conflictLoadedLatest: '已加载云端最新版本。',
    conflictOverwriteSuccess: '已强制覆盖并解决冲突。',
    geocodeError: '城市搜索失败，请换关键词或直接输入经纬度。',
    noGeocodeResult: '没有匹配到城市结果。',
    needUserName: '请先输入用户名。',
    duplicateUserName: '该用户名已存在。',
    needUserSelect: '请先创建或选择用户。',
    cannotDeleteLastUser: '至少保留一个用户。',
    deleteUserConfirm: '确认删除该用户吗？',
    userDeleteReassign: '该用户点位将迁移到',
    dangerSecondConfirm: '删除后不可恢复，请再次确认。',
    deletePointConfirm: '确认删除这个点位吗？',
    deletePhotoConfirm: '确认删除这张照片吗？',
    recycleBinTitle: '回收站',
    recycleBinHint: '删除内容可在 7 天内恢复。',
    recycleBinEmpty: '回收站为空。',
    recycleRestoreBtn: '恢复',
    recycleDeleteBtn: '立即删除',
    recycleDeletedAt: '删除于',
    recyclePointLabel: '点位',
    recyclePhotoLabel: '照片',
    recycleUserLabel: '用户',
    invalidRgb: 'RGB 格式应类似 255, 120, 0。',
    invalidCoord: '请输入有效的经纬度。',
    invalidCoordRange: '纬度范围需在 -90 到 90，经度需在 -180 到 180。',
    markerCountLabel: '个点位',
    userPointsLabel: '个点',
  },
};

const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const isNonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

const clampCoord = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeHexColor = (value, fallback) => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  const match = trimmed.match(/^#([0-9a-fA-F]{6})$/);
  return match ? `#${match[1].toLowerCase()}` : fallback;
};

const hexToRgbString = (hexColor) => {
  const cleaned = normalizeHexColor(hexColor, '#3b82f6').slice(1);
  const red = Number.parseInt(cleaned.slice(0, 2), 16);
  const green = Number.parseInt(cleaned.slice(2, 4), 16);
  const blue = Number.parseInt(cleaned.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
};

const rgbToHex = (rgbValue) => {
  if (typeof rgbValue !== 'string') {
    return null;
  }

  const cleaned = rgbValue
    .trim()
    .replace(/^rgb\(/i, '')
    .replace(/\)$/g, '')
    .replace(/\s+/g, '');

  const parts = cleaned.split(',');
  if (parts.length !== 3) {
    return null;
  }

  const channels = parts.map((part) => Number.parseInt(part, 10));
  if (channels.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)) {
    return null;
  }

  const [red, green, blue] = channels;
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
};

const normalizePhoto = (photo, index) => ({
  id: isNonEmpty(photo?.id) ? photo.id : makeId(`photo_${index}`),
  name: isNonEmpty(photo?.name) ? photo.name.trim() : '',
  url: isNonEmpty(photo?.url) ? photo.url.trim() : '',
  pathname: isNonEmpty(photo?.pathname) ? photo.pathname.trim() : '',
  thumbnailUrl: isNonEmpty(photo?.thumbnailUrl) ? photo.thumbnailUrl.trim() : '',
  thumbnailPathname: isNonEmpty(photo?.thumbnailPathname) ? photo.thumbnailPathname.trim() : '',
  contentType: isNonEmpty(photo?.contentType) ? photo.contentType.trim() : '',
  width: Number.isFinite(photo?.width) ? Math.max(1, Math.round(photo.width)) : null,
  height: Number.isFinite(photo?.height) ? Math.max(1, Math.round(photo.height)) : null,
  uploadState: photo?.uploadState === 'failed' ? 'failed' : (photo?.uploadState === 'uploading' ? 'uploading' : 'ready'),
  uploadProgress: Number.isFinite(photo?.uploadProgress) ? Math.max(0, Math.min(100, Math.round(photo.uploadProgress))) : 0,
  uploadError: isNonEmpty(photo?.uploadError) ? photo.uploadError.trim() : '',
});

const normalizeUser = (user, index, fallbackName) => ({
  id: isNonEmpty(user?.id) ? user.id : makeId(`user_${index}`),
  name: isNonEmpty(user?.name) ? user.name.trim() : `${fallbackName} ${index + 1}`,
  color: normalizeHexColor(user?.color, COLOR_PALETTE[index % COLOR_PALETTE.length]),
});

const normalizePoint = (point, index, users) => {
  const latitude = Number.parseFloat(point?.latitude);
  const longitude = Number.parseFloat(point?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const photos = Array.isArray(point?.photos)
    ? point.photos
        .map((photo, photoIndex) => normalizePhoto(photo, photoIndex))
        .filter((photo) => photo.url)
    : [];

  let featuredPhotoId = isNonEmpty(point?.featuredPhotoId) ? point.featuredPhotoId : null;
  let noFeatured = Boolean(point?.noFeatured);

  if (featuredPhotoId && !photos.some((photo) => photo.id === featuredPhotoId)) {
    featuredPhotoId = null;
  }

  if (!featuredPhotoId && photos.length === 0) {
    noFeatured = false;
  }

  if (!featuredPhotoId && photos.length === 1 && !noFeatured) {
    featuredPhotoId = photos[0].id;
  }

  const fallbackUserId = users[0]?.id || '';
  const userId = isNonEmpty(point?.userId) && users.some((user) => user.id === point.userId)
    ? point.userId
    : fallbackUserId;

  return {
    id: isNonEmpty(point?.id) ? point.id : makeId(`point_${index}`),
    userId,
    place: isNonEmpty(point?.place) ? point.place.trim() : '',
    latitude: clampCoord(latitude, -90, 90),
    longitude: clampCoord(longitude, -180, 180),
    route: isNonEmpty(point?.route) ? point.route.trim() : '',
    photos,
    featuredPhotoId,
    noFeatured,
  };
};

const loadImageFromBlob = (blob) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('Failed to decode image'));
  };
  image.src = objectUrl;
});

const canvasToBlob = (canvas, mimeType, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('Canvas export failed'));
      return;
    }
    resolve(blob);
  }, mimeType, quality);
});

const renderCompressedBlob = async (file, maxEdge, targetBytes) => {
  const image = await loadImageFromBlob(file);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;

  if (!originalWidth || !originalHeight) {
    throw new Error('Invalid image dimensions');
  }

  const scale = Math.min(1, maxEdge / Math.max(originalWidth, originalHeight));
  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) {
    throw new Error('Canvas unavailable');
  }
  context.drawImage(image, 0, 0, width, height);

  const preferredType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  let quality = preferredType === 'image/png' ? undefined : 0.9;
  let blob = await canvasToBlob(canvas, preferredType, quality);

  if (preferredType !== 'image/png' && targetBytes > 0) {
    while (blob.size > targetBytes && quality > 0.58) {
      quality -= 0.08;
      blob = await canvasToBlob(canvas, preferredType, quality);
    }
  }

  return {
    blob,
    width,
    height,
  };
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
  reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
  reader.readAsDataURL(blob);
});

const compressImageFile = async (file) => {
  const full = await renderCompressedBlob(file, MAX_CANVAS_EDGE, 1_700_000);
  const thumb = await renderCompressedBlob(file, MAX_THUMBNAIL_EDGE, 320_000);

  return {
    id: makeId('photo'),
    name: file.name,
    width: full.width,
    height: full.height,
    fullBlob: full.blob,
    thumbBlob: thumb.blob,
  };
};

const getPhotoBubbleSize = (photo) => {
  const width = Number.isFinite(photo?.width) ? photo.width : null;
  const height = Number.isFinite(photo?.height) ? photo.height : null;
  if (!width || !height) {
    return { width: 140, height: 96 };
  }

  const ratio = width / height;
  const bubbleHeight = Math.max(88, Math.min(150, Math.round(Math.min(height, 460) * 0.24)));
  const bubbleWidth = Math.max(88, Math.min(238, Math.round(bubbleHeight * ratio)));
  return { width: bubbleWidth, height: bubbleHeight };
};

const sanitizeFilename = (filename = '') => {
  const withoutControlChars = Array.from(String(filename || 'image'))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');

  const normalized = withoutControlChars
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'image';
};

const safeDateText = (value) => {
  if (!isNonEmpty(value)) {
    return '';
  }
  const stamp = new Date(value);
  if (Number.isNaN(stamp.getTime())) {
    return '';
  }
  return stamp.toISOString();
};

const normalizeRecycleItem = (item, index) => {
  const kind = ['point', 'photo', 'user'].includes(item?.kind) ? item.kind : 'point';
  return {
    id: isNonEmpty(item?.id) ? item.id : makeId(`recycle_${index}`),
    kind,
    deletedAt: safeDateText(item?.deletedAt) || new Date().toISOString(),
    title: isNonEmpty(item?.title) ? item.title.trim() : '',
    payload: item?.payload && typeof item.payload === 'object' && !Array.isArray(item.payload) ? item.payload : {},
  };
};

const normalizePlaceBookmark = (item, index) => {
  const latitude = Number.parseFloat(item?.latitude);
  const longitude = Number.parseFloat(item?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const name = isNonEmpty(item?.name)
    ? item.name.trim()
    : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  return {
    id: isNonEmpty(item?.id) ? item.id : makeId(`place_${index}`),
    name,
    latitude: clampCoord(latitude, -90, 90),
    longitude: clampCoord(longitude, -180, 180),
  };
};

const placeBookmarkKey = (item) => (
  `${item.name.toLowerCase()}__${item.latitude.toFixed(4)}__${item.longitude.toFixed(4)}`
);

const dedupePlaceBookmarks = (list, maxSize) => {
  const seen = new Set();
  const output = [];
  (Array.isArray(list) ? list : []).forEach((item, index) => {
    const normalized = normalizePlaceBookmark(item, index);
    if (!normalized) {
      return;
    }
    const key = placeBookmarkKey(normalized);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    output.push(normalized);
  });
  return output.slice(0, maxSize);
};

const normalizeSearchToken = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '');

const initialsToken = (value) => String(value || '')
  .toLowerCase()
  .split(/[^a-z0-9\u4e00-\u9fa5]+/g)
  .filter(Boolean)
  .map((token) => token[0] || '')
  .join('');

const placeMatchesQuery = (place, query) => {
  if (!isNonEmpty(query)) {
    return false;
  }
  const q = normalizeSearchToken(query);
  if (!q) {
    return false;
  }
  const nameToken = normalizeSearchToken(place?.name || '');
  const coordToken = normalizeSearchToken(`${place?.latitude || ''},${place?.longitude || ''}`);
  const shortToken = initialsToken(place?.name || '');
  return nameToken.includes(q) || coordToken.includes(q) || shortToken.startsWith(q);
};

const normalizeMapShare = (share) => ({
  enabled: share?.enabled === true,
  token: isNonEmpty(share?.token) ? share.token.trim() : '',
});

const buildClientShareUrl = (token) => {
  const nextToken = isNonEmpty(token) ? token.trim() : '';
  if (!nextToken || typeof window === 'undefined') {
    return '';
  }
  const url = new URL(window.location.href);
  url.searchParams.set('page', 'map');
  url.searchParams.set('share', nextToken);
  return `${url.origin}${url.pathname}?${url.searchParams.toString()}`;
};

const pruneRecycleItems = (items) => {
  const now = Date.now();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const stamp = new Date(item.deletedAt).getTime();
    if (Number.isNaN(stamp)) {
      return false;
    }
    return now - stamp <= RECYCLE_BIN_RETENTION_MS;
  });
};

const persistPhoto = (photo) => {
  if (!isNonEmpty(photo?.url)) {
    return null;
  }
  return {
    id: photo.id,
    name: photo.name || '',
    url: photo.url,
    pathname: photo.pathname || '',
    thumbnailUrl: photo.thumbnailUrl || '',
    thumbnailPathname: photo.thumbnailPathname || '',
    contentType: photo.contentType || '',
    width: Number.isFinite(photo.width) ? photo.width : null,
    height: Number.isFinite(photo.height) ? photo.height : null,
  };
};

const persistPoint = (point) => {
  const persistedPhotos = (Array.isArray(point?.photos) ? point.photos : [])
    .map(persistPhoto)
    .filter(Boolean);
  let featuredPhotoId = isNonEmpty(point?.featuredPhotoId) ? point.featuredPhotoId : null;
  if (featuredPhotoId && !persistedPhotos.some((photo) => photo.id === featuredPhotoId)) {
    featuredPhotoId = null;
  }
  return {
    id: point.id,
    userId: point.userId,
    place: point.place || '',
    latitude: point.latitude,
    longitude: point.longitude,
    route: point.route || '',
    photos: persistedPhotos,
    featuredPhotoId,
    noFeatured: Boolean(point.noFeatured),
  };
};

const isPointWithinBounds = (point, bounds, padding = 0.2) => {
  if (!bounds) {
    return true;
  }
  const latPad = Math.max(0.1, (bounds.north - bounds.south) * padding);
  const lngPad = Math.max(0.1, (bounds.east - bounds.west) * padding);
  return (
    point.latitude >= bounds.south - latPad
    && point.latitude <= bounds.north + latPad
    && point.longitude >= bounds.west - lngPad
    && point.longitude <= bounds.east + lngPad
  );
};

const parseWorkspace = (rawWorkspace, defaultName) => {
  const fallbackUser = {
    id: makeId('user'),
    name: defaultName,
    color: COLOR_PALETTE[0],
  };

  const safeWorkspace = rawWorkspace && typeof rawWorkspace === 'object' && !Array.isArray(rawWorkspace)
    ? rawWorkspace
    : {};

  const loadedScope = safeWorkspace?.scope === 'world' ? 'world' : 'china';
  const loadedShowFeaturedBubbles = safeWorkspace?.showFeaturedBubbles !== false;
  const loadedBubbleLayout = ['map', 'right', 'bottom'].includes(safeWorkspace?.bubbleLayout)
    ? safeWorkspace.bubbleLayout
    : 'right';

  const loadedUsers = Array.isArray(safeWorkspace?.users) && safeWorkspace.users.length
    ? safeWorkspace.users.map((user, index) => normalizeUser(user, index, defaultName))
    : [fallbackUser];

  const loadedPoints = Array.isArray(safeWorkspace?.points)
    ? safeWorkspace.points
        .map((point, index) => normalizePoint(point, index, loadedUsers))
        .filter(Boolean)
    : [];
  const loadedSearchHistory = dedupePlaceBookmarks(safeWorkspace?.searchHistory, MAX_PLACE_HISTORY);
  const loadedFavoritePlaces = dedupePlaceBookmarks(safeWorkspace?.favoritePlaces, MAX_FAVORITE_PLACES);
  const loadedRecycleBin = pruneRecycleItems(
    (Array.isArray(safeWorkspace?.recycleBin) ? safeWorkspace.recycleBin : [])
      .map((item, index) => normalizeRecycleItem(item, index)),
  );

  const savedAt = typeof safeWorkspace?.savedAt === 'string' ? safeWorkspace.savedAt : '';
  const savedAtStamp = Number.isNaN(new Date(savedAt).getTime()) ? 0 : new Date(savedAt).getTime();
  const rawRevision = Number.isFinite(safeWorkspace?.revision)
    ? safeWorkspace.revision
    : Number.parseInt(safeWorkspace?.revision, 10);
  const revision = Number.isInteger(rawRevision) && rawRevision >= 0 ? rawRevision : 0;
  const share = normalizeMapShare(safeWorkspace?.share);

  return {
    scope: loadedScope,
    users: loadedUsers,
    points: loadedPoints,
    searchHistory: loadedSearchHistory,
    favoritePlaces: loadedFavoritePlaces,
    recycleBin: loadedRecycleBin,
    share,
    revision,
    showFeaturedBubbles: loadedShowFeaturedBubbles,
    bubbleLayout: loadedBubbleLayout,
    savedAt,
    savedAtStamp,
  };
};

const workspaceToPayload = ({
  scope,
  users,
  points,
  searchHistory,
  favoritePlaces,
  recycleBin,
  revision,
  showFeaturedBubbles,
  bubbleLayout,
}) => ({
  scope: scope === 'world' ? 'world' : 'china',
  users: Array.isArray(users) ? users : [],
  points: Array.isArray(points) ? points.map(persistPoint) : [],
  searchHistory: dedupePlaceBookmarks(searchHistory, MAX_PLACE_HISTORY),
  favoritePlaces: dedupePlaceBookmarks(favoritePlaces, MAX_FAVORITE_PLACES),
  recycleBin: pruneRecycleItems(Array.isArray(recycleBin) ? recycleBin : []),
  revision: Number.isInteger(revision) && revision >= 0 ? revision : 0,
  showFeaturedBubbles: showFeaturedBubbles !== false,
  bubbleLayout: ['map', 'right', 'bottom'].includes(bubbleLayout) ? bubbleLayout : 'right',
  savedAt: new Date().toISOString(),
});

const workspaceHash = ({
  scope,
  users,
  points,
  searchHistory,
  favoritePlaces,
  recycleBin,
  revision,
  showFeaturedBubbles,
  bubbleLayout,
}) => JSON.stringify({
  scope: scope === 'world' ? 'world' : 'china',
  users: Array.isArray(users) ? users : [],
  points: Array.isArray(points) ? points.map(persistPoint) : [],
  searchHistory: dedupePlaceBookmarks(searchHistory, MAX_PLACE_HISTORY),
  favoritePlaces: dedupePlaceBookmarks(favoritePlaces, MAX_FAVORITE_PLACES),
  recycleBin: pruneRecycleItems(Array.isArray(recycleBin) ? recycleBin : []),
  revision: Number.isInteger(revision) && revision >= 0 ? revision : 0,
  showFeaturedBubbles: showFeaturedBubbles !== false,
  bubbleLayout: ['map', 'right', 'bottom'].includes(bubbleLayout) ? bubbleLayout : 'right',
});

const buildPhotoReadUrl = (photo, ownerId, options = {}) => {
  const { preferThumbnail = false, shareToken = '' } = options;
  const preferredPathname = preferThumbnail
    ? (isNonEmpty(photo?.thumbnailPathname) ? photo.thumbnailPathname.trim() : '')
    : '';
  const fallbackPathname = isNonEmpty(photo?.pathname) ? photo.pathname.trim() : '';
  const pathname = preferredPathname || fallbackPathname;

  if (pathname && isNonEmpty(shareToken)) {
    const params = new URLSearchParams({
      token: shareToken.trim(),
      pathname,
    });
    return `/api/maps-share-photo?${params.toString()}`;
  }

  if (pathname && ownerId) {
    const params = new URLSearchParams({
      action: 'read',
      pathname,
      targetUserId: ownerId,
      mode: 'inline',
    });
    return `/api/attachments?${params.toString()}`;
  }
  const preferredUrl = preferThumbnail
    ? (isNonEmpty(photo?.thumbnailUrl) ? photo.thumbnailUrl.trim() : '')
    : '';
  return preferredUrl || (isNonEmpty(photo?.url) ? photo.url.trim() : '');
};

function MapViewportController({ scope }) {
  const map = useMap();

  useEffect(() => {
    if (scope === 'china') {
      map.setMinZoom(CHINA_VIEW.minZoom);
      map.setMaxBounds(CHINA_BOUNDS);
      map.fitBounds(CHINA_BOUNDS, {
        paddingTopLeft: [8, 8],
        paddingBottomRight: [8, 8],
        animate: true,
        duration: 0.75,
      });
      return;
    }

    map.setMaxBounds(WORLD_BOUNDS);
    map.setMinZoom(WORLD_VIEW.minZoom);
    map.flyTo(WORLD_VIEW.center, WORLD_VIEW.zoom, { duration: 0.75 });
  }, [map, scope]);

  return null;
}

const getFeaturedPhoto = (point) => {
  if (!Array.isArray(point?.photos) || point.photos.length === 0) {
    return null;
  }

  if (point.featuredPhotoId) {
    return point.photos.find((photo) => photo.id === point.featuredPhotoId) || null;
  }

  if (point.photos.length === 1 && !point.noFeatured) {
    return point.photos[0];
  }

  return null;
};

function MapBookmarkCard({
  point,
  owner,
  ownerId,
  text,
  readOnly = false,
  photoSrcResolver,
  onUpdatePoint,
  onUploadPhotos,
  onSetFeatured,
  onClearFeatured,
  onDeletePhoto,
  onRetryPhoto,
  onDeletePoint,
}) {
  const [lightboxPhotoId, setLightboxPhotoId] = useState('');
  const [lightboxImageSrc, setLightboxImageSrc] = useState('');
  const swipeStartXRef = useRef(0);
  const swipeStartYRef = useRef(0);
  const swipeDeltaXRef = useRef(0);
  const swipeDeltaYRef = useRef(0);
  const hasPhotos = point.photos.length > 0;
  const lightboxPhotoIndex = hasPhotos
    ? point.photos.findIndex((photo) => photo.id === lightboxPhotoId)
    : -1;
  const activeLightboxPhoto = lightboxPhotoIndex >= 0 ? point.photos[lightboxPhotoIndex] : null;

  const closeLightbox = useCallback(() => {
    setLightboxPhotoId('');
  }, []);

  const openLightbox = useCallback((photoId) => {
    setLightboxPhotoId(photoId);
  }, []);

  const shiftLightboxPhoto = useCallback((step) => {
    if (!point.photos.length || !lightboxPhotoId) {
      return;
    }
    const index = point.photos.findIndex((photo) => photo.id === lightboxPhotoId);
    if (index < 0) {
      setLightboxPhotoId(point.photos[0].id);
      return;
    }
    const nextIndex = (index + step + point.photos.length) % point.photos.length;
    setLightboxPhotoId(point.photos[nextIndex].id);
  }, [lightboxPhotoId, point.photos]);

  useEffect(() => {
    if (!point.photos.length) {
      setLightboxPhotoId('');
      return;
    }
    if (lightboxPhotoId && !point.photos.some((photo) => photo.id === lightboxPhotoId)) {
      setLightboxPhotoId(point.photos[0].id);
    }
  }, [lightboxPhotoId, point.photos]);

  useEffect(() => {
    if (!activeLightboxPhoto) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeLightbox();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        shiftLightboxPhoto(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        shiftLightboxPhoto(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightboxPhoto, closeLightbox, shiftLightboxPhoto]);

  useEffect(() => {
    if (!activeLightboxPhoto) {
      setLightboxImageSrc('');
      return undefined;
    }

    let cancelled = false;
    const thumbSrc = photoSrcResolver(activeLightboxPhoto, ownerId, { preferThumbnail: true });
    const fullSrc = photoSrcResolver(activeLightboxPhoto, ownerId);
    setLightboxImageSrc(thumbSrc || fullSrc);

    if (!fullSrc || fullSrc === thumbSrc) {
      return undefined;
    }

    const fullImage = new Image();
    fullImage.onload = () => {
      if (!cancelled) {
        setLightboxImageSrc(fullSrc);
      }
    };
    fullImage.src = fullSrc;

    return () => {
      cancelled = true;
    };
  }, [activeLightboxPhoto, ownerId, photoSrcResolver]);

  useEffect(() => {
    if (!activeLightboxPhoto || point.photos.length < 2) {
      return;
    }

    const index = point.photos.findIndex((photo) => photo.id === activeLightboxPhoto.id);
    if (index < 0) {
      return;
    }

    const nearPhotos = [
      point.photos[(index - 1 + point.photos.length) % point.photos.length],
      point.photos[(index + 1) % point.photos.length],
    ];
    nearPhotos.forEach((photo) => {
      const src = photoSrcResolver(photo, ownerId);
      if (!src) {
        return;
      }
      const image = new Image();
      image.src = src;
    });
  }, [activeLightboxPhoto, ownerId, photoSrcResolver, point.photos]);

  const handleLightboxTouchStart = (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) {
      return;
    }
    swipeStartXRef.current = touch.clientX;
    swipeStartYRef.current = touch.clientY;
    swipeDeltaXRef.current = 0;
    swipeDeltaYRef.current = 0;
  };

  const handleLightboxTouchMove = (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) {
      return;
    }
    swipeDeltaXRef.current = touch.clientX - swipeStartXRef.current;
    swipeDeltaYRef.current = touch.clientY - swipeStartYRef.current;
  };

  const handleLightboxTouchEnd = () => {
    const absX = Math.abs(swipeDeltaXRef.current);
    const absY = Math.abs(swipeDeltaYRef.current);

    // Swipe down to close preview on touch devices.
    if (swipeDeltaYRef.current > 72 && absY > absX * 1.15) {
      closeLightbox();
      return;
    }

    if (Math.abs(swipeDeltaXRef.current) < 42) {
      return;
    }
    if (swipeDeltaXRef.current < 0) {
      shiftLightboxPhoto(1);
    } else {
      shiftLightboxPhoto(-1);
    }
  };

  const lightboxNode = activeLightboxPhoto && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="map-photo-lightbox"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="map-photo-lightbox-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="glass-button map-photo-lightbox-close"
              onClick={closeLightbox}
              aria-label={text.closePreviewBtn}
              title={text.closePreviewBtn}
            >
              ✕
            </button>
            <button
              type="button"
              className="glass-button map-photo-lightbox-nav prev"
              onClick={() => shiftLightboxPhoto(-1)}
              aria-label={text.prevPhotoBtn}
              title={text.prevPhotoBtn}
            >
              <span className="map-photo-lightbox-arrow left" aria-hidden="true" />
            </button>
            <div
              className="map-photo-lightbox-image-wrap"
              onTouchStart={handleLightboxTouchStart}
              onTouchMove={handleLightboxTouchMove}
              onTouchEnd={handleLightboxTouchEnd}
            >
              <img
                src={lightboxImageSrc || photoSrcResolver(activeLightboxPhoto, ownerId)}
                alt={activeLightboxPhoto.name || text.photosTitle}
              />
            </div>
            <button
              type="button"
              className="glass-button map-photo-lightbox-nav next"
              onClick={() => shiftLightboxPhoto(1)}
              aria-label={text.nextPhotoBtn}
              title={text.nextPhotoBtn}
            >
              <span className="map-photo-lightbox-arrow right" aria-hidden="true" />
            </button>
            <p className="map-photo-lightbox-caption">
              {activeLightboxPhoto.name || text.photosTitle}
              {point.photos.length > 1 ? ` (${lightboxPhotoIndex + 1}/${point.photos.length})` : ''}
            </p>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="map-bookmark-card">
      <div className="map-bookmark-head">
        <h4>{point.place || `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`}</h4>
        {!readOnly && (
          <button
            type="button"
            className="glass-button map-danger-btn"
            onClick={() => onDeletePoint(point.id)}
          >
            {text.removePointBtn}
          </button>
        )}
      </div>
      <p className="map-bookmark-meta">
        <strong>{text.ownerLabel}:</strong> {owner?.name || '-'}
      </p>
      <p className="map-bookmark-meta">
        <strong>{text.coordinateLabel}:</strong> {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
      </p>

      <label className="map-label" htmlFor={`route_${point.id}`}>{text.routeLabel}</label>
      <textarea
        id={`route_${point.id}`}
        className="glass-input map-textarea"
        value={point.route}
        placeholder={text.routePlaceholder}
        readOnly={readOnly}
        onChange={(event) => onUpdatePoint(point.id, { route: event.target.value })}
      />

      <div className="map-bookmark-photo-head">
        <strong>{text.photosTitle}</strong>
        {!readOnly && (
          <button
            type="button"
            className="glass-button map-clear-featured-btn"
            onClick={() => onClearFeatured(point.id)}
          >
            {text.clearFeaturedBtn}
          </button>
        )}
      </div>

      {!readOnly && (
        <>
          <label className="map-upload-label" htmlFor={`upload_${point.id}`}>{text.uploadPhotosLabel}</label>
          <input
            id={`upload_${point.id}`}
            type="file"
            accept="image/*"
            multiple
            className="glass-input map-file-input"
            onChange={(event) => {
              onUploadPhotos(point.id, event.target.files);
              event.target.value = '';
            }}
          />
        </>
      )}

      {point.photos.length === 0 && <p className="map-empty-line">{text.noPhotos}</p>}

      {point.photos.length > 0 && (
        <div className="map-photo-grid">
          {point.photos.map((photo) => {
            const isFeatured = photo.id === point.featuredPhotoId;
            const isUploading = photo.uploadState === 'uploading';
            const isFailed = photo.uploadState === 'failed';
            return (
              <figure key={photo.id} className={`map-photo-card ${isFeatured ? 'is-featured' : ''}`}>
                {photo.url ? (
                  <img src={photoSrcResolver(photo, ownerId, { preferThumbnail: true })} alt={photo.name || text.photosTitle} loading="lazy" />
                ) : (
                  <div className="map-photo-placeholder">
                    <span>{isFailed ? text.uploadFailedLabel : text.uploadingLabel}</span>
                    {isUploading && <small>{photo.uploadProgress || 0}%</small>}
                    {isFailed && photo.uploadError && <small title={photo.uploadError}>{photo.uploadError}</small>}
                  </div>
                )}
                <figcaption title={photo.name}>{photo.name || 'image'}</figcaption>
                <div className="map-photo-actions">
                  {!isUploading && photo.url && (
                    <button
                      type="button"
                      className="glass-button"
                      onClick={() => openLightbox(photo.id)}
                    >
                      {text.previewPhotoBtn}
                    </button>
                  )}
                  {!readOnly && !isUploading && photo.url && (
                    <button
                      type="button"
                      className="glass-button"
                      onClick={() => onSetFeatured(point.id, photo.id)}
                    >
                      {isFeatured ? text.featuredBadge : text.setFeaturedBtn}
                    </button>
                  )}
                  {!readOnly && isFailed && (
                    <button
                      type="button"
                      className="glass-button"
                      onClick={() => onRetryPhoto(point.id, photo.id)}
                    >
                      {text.retryUploadBtn}
                    </button>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      className="glass-button map-danger-btn"
                      onClick={() => onDeletePhoto(point.id, photo.id)}
                    >
                      {text.removePhotoBtn}
                    </button>
                  )}
                </div>
              </figure>
            );
          })}
        </div>
      )}

      {lightboxNode}
    </div>
  );
}

function MapView({
  activeUserId,
  activeUserName,
  language,
  onBackToSchedule,
  readOnly = false,
  sharedWorkspace = null,
  sharedOwnerName = '',
  sharedToken = '',
}) {
  const text = language === 'zh' ? TEXTS.zh : TEXTS.en;
  const storageKey = useMemo(
    () => (activeUserId ? `nanmuz_map_workspace_${activeUserId}` : null),
    [activeUserId],
  );

  const [scope, setScope] = useState('china');
  const [users, setUsers] = useState([]);
  const [points, setPoints] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [favoritePlaces, setFavoritePlaces] = useState([]);
  const [recycleBin, setRecycleBin] = useState([]);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isAddUserExpanded, setIsAddUserExpanded] = useState(false);
  const [isUserEditExpanded, setIsUserEditExpanded] = useState(false);
  const [showFeaturedBubbles, setShowFeaturedBubbles] = useState(true);
  const [bubbleLayout, setBubbleLayout] = useState('right');
  const [selectedPointId, setSelectedPointId] = useState('');

  const [newUserName, setNewUserName] = useState('');
  const [newUserColor, setNewUserColor] = useState(COLOR_PALETTE[0]);
  const [newUserRgb, setNewUserRgb] = useState(hexToRgbString(COLOR_PALETTE[0]));
  const [editUserName, setEditUserName] = useState('');
  const [editUserColor, setEditUserColor] = useState(COLOR_PALETTE[0]);
  const [editUserRgb, setEditUserRgb] = useState(hexToRgbString(COLOR_PALETTE[0]));
  const [expandedUserId, setExpandedUserId] = useState('');

  const [cityQuery, setCityQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');

  const [placeInput, setPlaceInput] = useState('');
  const [latitudeInput, setLatitudeInput] = useState('');
  const [longitudeInput, setLongitudeInput] = useState('');
  const [routeInput, setRouteInput] = useState('');
  const [addPointFiles, setAddPointFiles] = useState([]);
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [uploadQueueStatus, setUploadQueueStatus] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    active: 0,
  });
  const [mapInstance, setMapInstance] = useState(null);
  const [dockLines, setDockLines] = useState([]);
  const [visibleBounds, setVisibleBounds] = useState(null);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareToken, setShareToken] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [isShareBusy, setIsShareBusy] = useState(false);
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isServerHydrated, setIsServerHydrated] = useState(false);
  const autoUploadTimerRef = useRef(null);
  const lastServerHashRef = useRef('');
  const localLoadedAtRef = useRef(0);
  const addPointFileInputRef = useRef(null);
  const bookmarkEditorRef = useRef(null);
  const mapCanvasColumnRef = useRef(null);
  const featuredDockRef = useRef(null);
  const featuredDockItemRefs = useRef(new Map());
  const uploadQueueRef = useRef([]);
  const uploadRunnerActiveRef = useRef(false);
  const failedUploadFileRef = useRef(new Map());
  const activeWorkspaceKeyRef = useRef('');

  useEffect(() => () => {
    if (autoUploadTimerRef.current) {
      clearTimeout(autoUploadTimerRef.current);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      const defaultName = sharedOwnerName || activeUserName || (language === 'zh' ? '用户' : 'User');
      if (readOnly && sharedWorkspace) {
        const loadedWorkspace = parseWorkspace(sharedWorkspace, defaultName);
        if (cancelled) {
          return;
        }
        localLoadedAtRef.current = loadedWorkspace.savedAtStamp;
        setScope(loadedWorkspace.scope);
        setUsers(loadedWorkspace.users);
        setPoints(loadedWorkspace.points);
        setSearchHistory(loadedWorkspace.searchHistory);
        setFavoritePlaces(loadedWorkspace.favoritePlaces);
        setRecycleBin(loadedWorkspace.recycleBin);
        setWorkspaceRevision(loadedWorkspace.revision);
        const loadedShare = normalizeMapShare(loadedWorkspace.share);
        const tokenFromProps = isNonEmpty(sharedToken) ? sharedToken.trim() : '';
        const effectiveToken = loadedShare.token || tokenFromProps;
        setShareEnabled(loadedShare.enabled || Boolean(tokenFromProps));
        setShareToken(effectiveToken);
        setShareUrl((loadedShare.enabled || tokenFromProps) ? buildClientShareUrl(effectiveToken) : '');
        setShowFeaturedBubbles(loadedWorkspace.showFeaturedBubbles);
        setBubbleLayout(loadedWorkspace.bubbleLayout);
        setSelectedUserId(loadedWorkspace.users[0]?.id || '');
        setExpandedUserId(loadedWorkspace.users[0]?.id || '');
        setSelectedPointId('');
        setFormMessage('');
        setIsServerHydrated(true);
        setIsLoaded(true);
        return;
      }

      const fallbackName = activeUserName || (language === 'zh' ? '用户' : 'User');
      let loadedWorkspace = parseWorkspace(null, defaultName);

      if (storageKey) {
        try {
          const fromDb = await readWorkspaceFromDb(storageKey);
          const localBackup = localStorage.getItem(storageKey);
          const parsed = fromDb || (localBackup ? JSON.parse(localBackup) : null);
          loadedWorkspace = parseWorkspace(parsed, fallbackName);
        } catch {
          loadedWorkspace = parseWorkspace(null, fallbackName);
        }
      }

      if (cancelled) {
        return;
      }

      localLoadedAtRef.current = loadedWorkspace.savedAtStamp;
      setScope(loadedWorkspace.scope);
      setUsers(loadedWorkspace.users);
      setPoints(loadedWorkspace.points);
      setSearchHistory(loadedWorkspace.searchHistory);
      setFavoritePlaces(loadedWorkspace.favoritePlaces);
      setRecycleBin(loadedWorkspace.recycleBin);
      setWorkspaceRevision(loadedWorkspace.revision);
      const loadedShare = normalizeMapShare(loadedWorkspace.share);
      setShareEnabled(loadedShare.enabled);
      setShareToken(loadedShare.token);
      setShareUrl(loadedShare.enabled ? buildClientShareUrl(loadedShare.token) : '');
      setShowFeaturedBubbles(loadedWorkspace.showFeaturedBubbles);
      setBubbleLayout(loadedWorkspace.bubbleLayout);
      setSelectedUserId(loadedWorkspace.users[0]?.id || '');
      setExpandedUserId(loadedWorkspace.users[0]?.id || '');
      setSelectedPointId('');
      setNewUserColor(COLOR_PALETTE[1]);
      setNewUserRgb(hexToRgbString(COLOR_PALETTE[1]));
      setFormMessage('');
      setAddPointFiles([]);
      if (addPointFileInputRef.current) {
        addPointFileInputRef.current.value = '';
      }
      activeWorkspaceKeyRef.current = storageKey || '';
      uploadQueueRef.current = [];
      failedUploadFileRef.current.clear();
      setUploadQueueStatus({
        total: 0,
        completed: 0,
        failed: 0,
        active: 0,
      });
      setIsServerHydrated(false);
      lastServerHashRef.current = '';
      setIsLoaded(true);
    };

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [activeUserName, language, readOnly, sharedOwnerName, sharedToken, sharedWorkspace, storageKey]);

  useEffect(() => {
    if (readOnly || !isLoaded || !activeUserId) {
      return undefined;
    }

    let cancelled = false;
    const defaultName = activeUserName || (language === 'zh' ? '用户' : 'User');

    const hydrateFromServer = async () => {
      try {
        const response = await fetch(`/api/maps?t=${Date.now()}`, {
          credentials: 'same-origin',
        });
        if (response.status === 401) {
          return;
        }

        const result = await response.json();
        if (!response.ok || result.status !== 'success') {
          throw new Error(result.message || 'Failed to load map workspace');
        }

        const serverWorkspace = parseWorkspace(result.workspace, defaultName);
        const serverHash = workspaceHash(serverWorkspace);

        if (cancelled) {
          return;
        }

        lastServerHashRef.current = serverHash;

        if (serverWorkspace.savedAtStamp >= localLoadedAtRef.current) {
          setScope(serverWorkspace.scope);
          setUsers(serverWorkspace.users);
          setPoints(serverWorkspace.points);
          setSearchHistory(serverWorkspace.searchHistory);
          setFavoritePlaces(serverWorkspace.favoritePlaces);
          setRecycleBin(serverWorkspace.recycleBin);
          setWorkspaceRevision(serverWorkspace.revision);
          const serverShare = normalizeMapShare(serverWorkspace.share);
          setShareEnabled(serverShare.enabled);
          setShareToken(serverShare.token);
          setShareUrl(serverShare.enabled ? buildClientShareUrl(serverShare.token) : '');
          setShowFeaturedBubbles(serverWorkspace.showFeaturedBubbles);
          setBubbleLayout(serverWorkspace.bubbleLayout);
          setSelectedUserId(serverWorkspace.users[0]?.id || '');
          setExpandedUserId(serverWorkspace.users[0]?.id || '');
          setSelectedPointId('');
        }
      } catch {
        // Keep local workspace when server sync is unavailable.
      } finally {
        if (!cancelled) {
          setIsServerHydrated(true);
        }
      }
    };

    hydrateFromServer();

    return () => {
      cancelled = true;
    };
  }, [activeUserId, activeUserName, isLoaded, language, readOnly]);

  useEffect(() => {
    if (readOnly || !isLoaded || !storageKey) {
      return;
    }

    const payload = workspaceToPayload({
      scope,
      users,
      points,
      searchHistory,
      favoritePlaces,
      recycleBin,
      revision: workspaceRevision,
      showFeaturedBubbles,
      bubbleLayout,
    });

    (async () => {
      try {
        await writeWorkspaceToDb(storageKey, payload);
        localStorage.setItem(storageKey, JSON.stringify({
          scope: payload.scope,
          showFeaturedBubbles: payload.showFeaturedBubbles,
          bubbleLayout: payload.bubbleLayout,
          users: payload.users,
          points: [],
          searchHistory: payload.searchHistory,
          favoritePlaces: payload.favoritePlaces,
          recycleBin: payload.recycleBin,
          revision: payload.revision,
          savedAt: payload.savedAt,
        }));
      } catch {
        try {
          localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch {
          setFormMessage(text.storageLimitError);
        }
      }
    })();
  }, [bubbleLayout, favoritePlaces, isLoaded, points, readOnly, recycleBin, scope, searchHistory, showFeaturedBubbles, storageKey, text.storageLimitError, users, workspaceRevision]);

  useEffect(() => {
    if (readOnly || !isLoaded || !isServerHydrated || !activeUserId) {
      return undefined;
    }

    const defaultName = activeUserName || (language === 'zh' ? '用户' : 'User');
    const nextPayload = workspaceToPayload({
      scope,
      users,
      points,
      searchHistory,
      favoritePlaces,
      recycleBin,
      revision: workspaceRevision,
      showFeaturedBubbles,
      bubbleLayout,
    });
    const nextHash = workspaceHash(nextPayload);

    if (nextHash === lastServerHashRef.current) {
      return undefined;
    }

    if (autoUploadTimerRef.current) {
      clearTimeout(autoUploadTimerRef.current);
    }

    autoUploadTimerRef.current = setTimeout(async () => {
      const expectedRevision = workspaceRevision;
      const postWorkspace = async (force = false) => {
        const response = await fetch('/api/maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            workspace: nextPayload,
            expectedRevision,
            force,
          }),
        });
        const result = await response.json().catch(() => null);
        return { response, result };
      };

      try {
        const { response, result } = await postWorkspace(false);
        if (response.status === 409 && result?.workspace) {
          const shouldLoadLatest = window.confirm(`${text.conflictDetected}\n${text.conflictLoadLatest}`);
          if (shouldLoadLatest) {
            const latest = parseWorkspace(result.workspace, defaultName);
            setScope(latest.scope);
            setUsers(latest.users);
            setPoints(latest.points);
            setSearchHistory(latest.searchHistory);
            setFavoritePlaces(latest.favoritePlaces);
            setRecycleBin(latest.recycleBin);
            setWorkspaceRevision(latest.revision);
            const latestShare = normalizeMapShare(latest.share);
            setShareEnabled(latestShare.enabled);
            setShareToken(latestShare.token);
            setShareUrl(latestShare.enabled ? buildClientShareUrl(latestShare.token) : '');
            setShowFeaturedBubbles(latest.showFeaturedBubbles);
            setBubbleLayout(latest.bubbleLayout);
            setSelectedUserId(latest.users[0]?.id || '');
            setExpandedUserId(latest.users[0]?.id || '');
            setSelectedPointId('');
            lastServerHashRef.current = workspaceHash(latest);
            setFormMessage(text.conflictLoadedLatest);
            return;
          }

          const shouldForceOverwrite = window.confirm(text.conflictForceOverwrite);
          if (!shouldForceOverwrite) {
            setFormMessage(text.conflictNoAction);
            return;
          }

          const forced = await postWorkspace(true);
          if (!forced.response.ok || forced.result?.status !== 'success') {
            if (forced.result?.message) {
              setFormMessage(forced.result.message);
            }
            return;
          }

          const forcedWorkspace = parseWorkspace(forced.result.workspace, defaultName);
          setWorkspaceRevision(forcedWorkspace.revision);
          const forcedShare = normalizeMapShare(forcedWorkspace.share);
          setShareEnabled(forcedShare.enabled);
          setShareToken(forcedShare.token);
          setShareUrl(forcedShare.enabled ? buildClientShareUrl(forcedShare.token) : '');
          lastServerHashRef.current = workspaceHash(forcedWorkspace);
          setFormMessage(text.conflictOverwriteSuccess);
          return;
        }

        if (!response.ok || result?.status !== 'success') {
          if (result?.message) {
            setFormMessage(result.message);
          }
          return;
        }

        const savedWorkspace = parseWorkspace(result.workspace, defaultName);
        setWorkspaceRevision(savedWorkspace.revision);
        const savedShare = normalizeMapShare(savedWorkspace.share);
        setShareEnabled(savedShare.enabled);
        setShareToken(savedShare.token);
        setShareUrl(savedShare.enabled ? buildClientShareUrl(savedShare.token) : '');
        lastServerHashRef.current = workspaceHash(savedWorkspace);
      } catch {
        // Keep local copy and retry on next workspace mutation.
      }
    }, MAP_AUTO_UPLOAD_DELAY_MS);

    return () => {
      if (autoUploadTimerRef.current) {
        clearTimeout(autoUploadTimerRef.current);
      }
    };
  }, [
    activeUserId,
    activeUserName,
    bubbleLayout,
    isLoaded,
    isServerHydrated,
    language,
    points,
    searchHistory,
    favoritePlaces,
    recycleBin,
    scope,
    showFeaturedBubbles,
    readOnly,
    text.conflictDetected,
    text.conflictForceOverwrite,
    text.conflictLoadLatest,
    text.conflictLoadedLatest,
    text.conflictNoAction,
    text.conflictOverwriteSuccess,
    users,
    workspaceRevision,
  ]);

  useEffect(() => {
    if (!users.length) {
      setSelectedUserId('');
      setExpandedUserId('');
      return;
    }

    if (!users.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(users[0].id);
    }
    if (!users.some((user) => user.id === expandedUserId)) {
      setExpandedUserId(users[0].id);
    }
  }, [expandedUserId, selectedUserId, users]);

  useEffect(() => {
    if (!selectedPointId) {
      return;
    }
    if (!points.some((point) => point.id === selectedPointId)) {
      setSelectedPointId('');
    }
  }, [points, selectedPointId]);

  useEffect(() => {
    if (!selectedPointId) {
      return undefined;
    }

    const handlePointerDownOutsideEditor = (event) => {
      const editorNode = bookmarkEditorRef.current;
      if (!editorNode) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.map-photo-lightbox')) {
        return;
      }
      if (editorNode.contains(event.target)) {
        return;
      }
      setSelectedPointId('');
    };

    document.addEventListener('pointerdown', handlePointerDownOutsideEditor);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutsideEditor);
    };
  }, [selectedPointId]);

  useEffect(() => {
    if (!selectedPointId) {
      return undefined;
    }

    const handleEscCloseEditor = (event) => {
      if (event.key === 'Escape') {
        setSelectedPointId('');
      }
    };

    document.addEventListener('keydown', handleEscCloseEditor);
    return () => {
      document.removeEventListener('keydown', handleEscCloseEditor);
    };
  }, [selectedPointId]);

  const cleanupPhotoStorage = useCallback((photo) => {
    if (!activeUserId) {
      return;
    }
    [photo?.pathname, photo?.thumbnailPathname].forEach((pathname) => {
      if (!isNonEmpty(pathname)) {
        return;
      }
      fetch('/api/attachments?action=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          targetUserId: activeUserId,
          pathname,
          url: photo?.url || '',
        }),
      }).catch(() => {});
    });
  }, [activeUserId]);

  useEffect(() => {
    if (!recycleBin.length) {
      return;
    }
    const now = Date.now();
    const expired = recycleBin.filter((item) => {
      const stamp = new Date(item.deletedAt).getTime();
      if (Number.isNaN(stamp)) {
        return true;
      }
      return now - stamp > RECYCLE_BIN_RETENTION_MS;
    });
    if (!expired.length) {
      return;
    }

    expired.forEach((item) => {
      if (item.kind === 'photo') {
        cleanupPhotoStorage(item.payload?.photo);
      } else if (item.kind === 'point') {
        const photos = Array.isArray(item.payload?.point?.photos) ? item.payload.point.photos : [];
        photos.forEach((photo) => cleanupPhotoStorage(photo));
      }
    });

    setRecycleBin((previous) => pruneRecycleItems(previous));
  }, [cleanupPhotoStorage, recycleBin]);

  const userMap = useMemo(() => {
    const map = new Map();
    users.forEach((user) => {
      map.set(user.id, user);
    });
    return map;
  }, [users]);

  const markerCountByUser = useMemo(() => points.reduce((accumulator, point) => {
    accumulator[point.userId] = (accumulator[point.userId] || 0) + 1;
    return accumulator;
  }, {}), [points]);
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId],
  );
  const expandedUserPoints = useMemo(
    () => points.filter((point) => point.userId === expandedUserId),
    [expandedUserId, points],
  );
  const localMatchPlaces = useMemo(() => {
    if (!isNonEmpty(cityQuery)) {
      return [];
    }
    const merged = dedupePlaceBookmarks([...favoritePlaces, ...searchHistory], MAX_FAVORITE_PLACES + MAX_PLACE_HISTORY);
    return merged
      .filter((item) => placeMatchesQuery(item, cityQuery))
      .slice(0, 8);
  }, [cityQuery, favoritePlaces, searchHistory]);

  const featuredPoints = useMemo(() => points
    .map((point) => {
      const featuredPhoto = getFeaturedPhoto(point);
      if (!featuredPhoto) {
        return null;
      }
      return {
        point,
        owner: userMap.get(point.userId),
        featuredPhoto,
      };
    })
    .filter(Boolean), [points, userMap]);
  const dockFeaturedPoints = useMemo(() => {
    if (bubbleLayout === 'map') {
      return featuredPoints;
    }

    const next = [...featuredPoints];
    if (bubbleLayout === 'right') {
      next.sort((left, right) => right.point.latitude - left.point.latitude);
      return next;
    }

    if (bubbleLayout === 'bottom') {
      next.sort((left, right) => left.point.longitude - right.point.longitude);
      return next;
    }

    return next;
  }, [bubbleLayout, featuredPoints]);
  const visiblePoints = useMemo(() => {
    if (!visibleBounds) {
      return points;
    }
    return points.filter((point) => (
      point.id === selectedPointId
      || isPointWithinBounds(point, visibleBounds)
    ));
  }, [points, selectedPointId, visibleBounds]);

  const selectedPoint = useMemo(
    () => points.find((point) => point.id === selectedPointId) || null,
    [points, selectedPointId],
  );
  const selectedPointOwner = selectedPoint ? userMap.get(selectedPoint.userId) : null;
  const uploadProcessedCount = uploadQueueStatus.completed + uploadQueueStatus.failed;
  const uploadProgressPercent = uploadQueueStatus.total > 0
    ? Math.round((uploadProcessedCount / uploadQueueStatus.total) * 100)
    : 0;
  const effectiveShareToken = readOnly
    ? ((isNonEmpty(shareToken) ? shareToken : sharedToken) || '')
    : '';
  const resolvePhotoSrc = useCallback(
    (photo, ownerId, options = {}) => buildPhotoReadUrl(photo, ownerId || activeUserId, {
      ...options,
      shareToken: effectiveShareToken,
    }),
    [activeUserId, effectiveShareToken],
  );
  const setDockItemRef = useCallback((pointId, node) => {
    if (!pointId) {
      return;
    }
    if (node) {
      featuredDockItemRefs.current.set(pointId, node);
    } else {
      featuredDockItemRefs.current.delete(pointId);
    }
  }, []);

  const recomputeDockLines = useCallback(() => {
    if (!mapInstance || !mapCanvasColumnRef.current || !showFeaturedBubbles || bubbleLayout === 'map') {
      setDockLines([]);
      return;
    }

    const columnRect = mapCanvasColumnRef.current.getBoundingClientRect();
    const mapRect = mapInstance.getContainer().getBoundingClientRect();
    if (!columnRect.width || !columnRect.height || !mapRect.width || !mapRect.height) {
      setDockLines([]);
      return;
    }

    const nextLines = [];

    dockFeaturedPoints.forEach(({ point, owner }) => {
      const dockItem = featuredDockItemRefs.current.get(point.id);
      if (!dockItem) {
        return;
      }

      const markerPixel = mapInstance.latLngToContainerPoint([point.latitude, point.longitude]);
      const startX = mapRect.left - columnRect.left + markerPixel.x;
      const startY = mapRect.top - columnRect.top + markerPixel.y;

      const dockRect = dockItem.getBoundingClientRect();
      const endX = bubbleLayout === 'right'
        ? dockRect.left - columnRect.left + 2
        : dockRect.left - columnRect.left + dockRect.width / 2;
      const endY = bubbleLayout === 'right'
        ? dockRect.top - columnRect.top + dockRect.height / 2
        : dockRect.top - columnRect.top + 2;

      nextLines.push({
        id: point.id,
        color: owner?.color || '#38bdf8',
        startX,
        startY,
        endX,
        endY,
      });
    });

    setDockLines(nextLines);
  }, [bubbleLayout, dockFeaturedPoints, mapInstance, showFeaturedBubbles]);

  useEffect(() => {
    if (!mapInstance) {
      return undefined;
    }

    const updateLines = () => {
      window.requestAnimationFrame(recomputeDockLines);
    };

    updateLines();
    mapInstance.on('move zoom resize', updateLines);
    window.addEventListener('resize', updateLines);
    const dockNode = featuredDockRef.current;
    if (dockNode) {
      dockNode.addEventListener('scroll', updateLines);
    }

    return () => {
      mapInstance.off('move zoom resize', updateLines);
      window.removeEventListener('resize', updateLines);
      if (dockNode) {
        dockNode.removeEventListener('scroll', updateLines);
      }
    };
  }, [mapInstance, recomputeDockLines]);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(recomputeDockLines);
    return () => window.cancelAnimationFrame(rafId);
  }, [bubbleLayout, dockFeaturedPoints, recomputeDockLines, showFeaturedBubbles]);

  useEffect(() => {
    if (!mapInstance) {
      setVisibleBounds(null);
      return undefined;
    }

    const updateBounds = () => {
      const bounds = mapInstance.getBounds();
      setVisibleBounds({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    };

    updateBounds();
    mapInstance.on('move zoom resize', updateBounds);
    return () => {
      mapInstance.off('move zoom resize', updateBounds);
    };
  }, [mapInstance]);

  useEffect(() => {
    setEditUserName(selectedUser?.name || '');
    const selectedColor = normalizeHexColor(selectedUser?.color, COLOR_PALETTE[0]);
    setEditUserColor(selectedColor);
    setEditUserRgb(hexToRgbString(selectedColor));
  }, [selectedUser?.id, selectedUser?.name, selectedUser?.color]);

  const handleNewRgbChange = (value) => {
    setNewUserRgb(value);
    const parsed = rgbToHex(value);
    if (parsed) {
      setNewUserColor(parsed);
      setFormMessage('');
    }
  };

  const handleEditRgbChange = (value) => {
    setEditUserRgb(value);
    const parsed = rgbToHex(value);
    if (parsed) {
      setEditUserColor(parsed);
      setFormMessage('');
    }
  };

  const handleAddUser = () => {
    const name = newUserName.trim();
    if (!name) {
      setFormMessage(text.needUserName);
      return;
    }

    if (users.some((user) => user.name.toLowerCase() === name.toLowerCase())) {
      setFormMessage(text.duplicateUserName);
      return;
    }

    const parsedHex = rgbToHex(newUserRgb);
    if (!parsedHex) {
      setFormMessage(text.invalidRgb);
      return;
    }

    const user = {
      id: makeId('user'),
      name,
      color: normalizeHexColor(parsedHex, COLOR_PALETTE[users.length % COLOR_PALETTE.length]),
    };

    setUsers((previous) => [...previous, user]);
    setSelectedUserId(user.id);
    setExpandedUserId(user.id);
    setNewUserName('');

    const nextColor = COLOR_PALETTE[(users.length + 1) % COLOR_PALETTE.length];
    setNewUserColor(nextColor);
    setNewUserRgb(hexToRgbString(nextColor));
    setFormMessage('');
  };

  const handleRenameUser = () => {
    if (!selectedUser) {
      setFormMessage(text.needUserSelect);
      return;
    }

    const nextName = editUserName.trim();
    if (!nextName) {
      setFormMessage(text.needUserName);
      return;
    }

    if (users.some((user) => user.id !== selectedUser.id && user.name.toLowerCase() === nextName.toLowerCase())) {
      setFormMessage(text.duplicateUserName);
      return;
    }

    const parsedColor = rgbToHex(editUserRgb);
    if (!parsedColor) {
      setFormMessage(text.invalidRgb);
      return;
    }
    const normalizedColor = normalizeHexColor(parsedColor, selectedUser.color);

    setUsers((previous) => previous.map((user) => (
      user.id === selectedUser.id
        ? { ...user, name: nextName, color: normalizedColor }
        : user
    )));
    setFormMessage('');
  };

  const handleDeleteUser = () => {
    if (!selectedUser) {
      setFormMessage(text.needUserSelect);
      return;
    }

    if (users.length <= 1) {
      setFormMessage(text.cannotDeleteLastUser);
      return;
    }

    const fallbackUser = users.find((user) => user.id !== selectedUser.id);
    if (!fallbackUser) {
      setFormMessage(text.cannotDeleteLastUser);
      return;
    }

    const shouldDelete = confirmDangerAction(
      `${text.deleteUserConfirm} "${selectedUser.name}"\n${text.userDeleteReassign} "${fallbackUser.name}"`,
      `${text.dangerSecondConfirm}\n"${selectedUser.name}"`,
    );
    if (!shouldDelete) {
      return;
    }

    setPoints((previous) => previous.map((point) => (
      point.userId === selectedUser.id
        ? { ...point, userId: fallbackUser.id }
        : point
    )));
    const movedPointIds = points
      .filter((point) => point.userId === selectedUser.id)
      .map((point) => point.id);
    pushRecycleItem({
      kind: 'user',
      title: selectedUser.name,
      payload: {
        user: selectedUser,
        fallbackUserId: fallbackUser.id,
        movedPointIds,
      },
    });
    setUsers((previous) => previous.filter((user) => user.id !== selectedUser.id));
    setSelectedUserId(fallbackUser.id);
    setExpandedUserId(fallbackUser.id);
    setFormMessage('');
  };

  const handleEditPointFromUserList = (pointId) => {
    setSelectedPointId(pointId);
  };

  const confirmDangerAction = (firstMessage, secondMessage = text.dangerSecondConfirm) => {
    if (!window.confirm(firstMessage)) {
      return false;
    }
    return window.confirm(secondMessage);
  };

  const pushRecycleItem = useCallback((item) => {
    setRecycleBin((previous) => pruneRecycleItems([
      {
        id: makeId('recycle'),
        deletedAt: new Date().toISOString(),
        title: '',
        payload: {},
        ...item,
      },
      ...previous,
    ]));
  }, []);

  const placeFromResult = useCallback((result) => normalizePlaceBookmark({
    id: result?.id,
    name: result?.name,
    latitude: result?.latitude,
    longitude: result?.longitude,
  }, 0), []);

  const addToSearchHistory = useCallback((place) => {
    const normalized = normalizePlaceBookmark(place, 0);
    if (!normalized) {
      return;
    }
    setSearchHistory((previous) => dedupePlaceBookmarks([normalized, ...previous], MAX_PLACE_HISTORY));
  }, []);

  const isFavoritePlace = useCallback((place) => {
    const normalized = normalizePlaceBookmark(place, 0);
    if (!normalized) {
      return false;
    }
    const key = placeBookmarkKey(normalized);
    return favoritePlaces.some((item) => placeBookmarkKey(item) === key);
  }, [favoritePlaces]);

  const toggleFavoritePlace = useCallback((place) => {
    const normalized = normalizePlaceBookmark(place, 0);
    if (!normalized) {
      return;
    }
    const key = placeBookmarkKey(normalized);
    setFavoritePlaces((previous) => {
      if (previous.some((item) => placeBookmarkKey(item) === key)) {
        return previous.filter((item) => placeBookmarkKey(item) !== key);
      }
      return dedupePlaceBookmarks([normalized, ...previous], MAX_FAVORITE_PLACES);
    });
  }, []);

  const applyQuickPlace = useCallback((place) => {
    const normalized = normalizePlaceBookmark(place, 0);
    if (!normalized) {
      return;
    }
    setPlaceInput(normalized.name);
    setLatitudeInput(normalized.latitude.toFixed(6));
    setLongitudeInput(normalized.longitude.toFixed(6));
    setSearchResults([]);
    setSearchMessage('');
    setFormMessage('');
    addToSearchHistory(normalized);
  }, [addToSearchHistory]);

  const handleSearchCity = async () => {
    const query = cityQuery.trim();
    if (!query) {
      setSearchMessage(text.noGeocodeResult);
      return;
    }

    setIsSearching(true);
    setSearchMessage('');

    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        limit: '8',
        q: query,
        addressdetails: '1',
      });

      if (scope === 'china') {
        params.set('countrycodes', 'cn');
      }

      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: {
          'Accept-Language': language === 'zh' ? 'zh-CN,zh;q=0.9,en;q=0.7' : 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) {
        throw new Error('Geocode request failed');
      }

      const data = await response.json();
      const normalized = Array.isArray(data)
        ? data
            .map((item, index) => ({
              id: String(item.place_id || `${index}`),
              name: item.display_name || query,
              latitude: Number.parseFloat(item.lat),
              longitude: Number.parseFloat(item.lon),
            }))
            .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
        : [];

      if (!normalized.length) {
        setSearchResults([]);
        setSearchMessage(text.noGeocodeResult);
        return;
      }

      setSearchResults(normalized);
      setSearchMessage('');
    } catch {
      setSearchResults([]);
      setSearchMessage(text.geocodeError);
    } finally {
      setIsSearching(false);
    }
  };

  const applySearchResult = (result) => {
    const place = placeFromResult(result);
    if (!place) {
      return;
    }
    applyQuickPlace(place);
  };

  const getCurrentInputPlace = useCallback(() => {
    const latitude = Number.parseFloat(latitudeInput);
    const longitude = Number.parseFloat(longitudeInput);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    return normalizePlaceBookmark({
      name: placeInput.trim() || cityQuery.trim() || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      latitude,
      longitude,
    }, 0);
  }, [cityQuery, latitudeInput, longitudeInput, placeInput]);

  const saveCurrentPlaceToFavorites = useCallback(() => {
    const place = getCurrentInputPlace();
    if (!place) {
      setFormMessage(text.invalidCoord);
      return;
    }
    toggleFavoritePlace(place);
    addToSearchHistory(place);
    setFormMessage('');
  }, [addToSearchHistory, getCurrentInputPlace, text.invalidCoord, toggleFavoritePlace]);

  const applyShareState = useCallback((incomingShare, explicitUrl = '') => {
    const nextShare = normalizeMapShare(incomingShare);
    const nextUrl = explicitUrl || (nextShare.enabled ? buildClientShareUrl(nextShare.token) : '');
    setShareEnabled(nextShare.enabled);
    setShareToken(nextShare.token);
    setShareUrl(nextUrl);
  }, []);

  const updateShareSetting = useCallback(async (action) => {
    if (readOnly || !activeUserId) {
      return;
    }
    if (action === 'disable' && !window.confirm(text.shareDisableConfirm)) {
      return;
    }
    if (action === 'regenerate' && !window.confirm(text.shareRegenerateConfirm)) {
      return;
    }

    setIsShareBusy(true);
    try {
      const response = await fetch('/api/maps-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.status !== 'success') {
        throw new Error(result?.message || 'Share update failed');
      }
      applyShareState(result?.share, result?.share?.url || '');
      setFormMessage('');
    } catch (error) {
      setFormMessage(error?.message || text.shareCopyFailed);
    } finally {
      setIsShareBusy(false);
    }
  }, [
    activeUserId,
    applyShareState,
    readOnly,
    text.shareCopyFailed,
    text.shareDisableConfirm,
    text.shareRegenerateConfirm,
  ]);

  const copyShareLink = useCallback(async () => {
    const urlToCopy = shareUrl || (shareEnabled ? buildClientShareUrl(shareToken) : '');
    if (!urlToCopy) {
      setFormMessage(text.shareCopyFailed);
      return;
    }

    try {
      await navigator.clipboard.writeText(urlToCopy);
      setFormMessage(text.shareCopied);
    } catch {
      setFormMessage(text.shareCopyFailed);
    }
  }, [shareEnabled, shareToken, shareUrl, text.shareCopied, text.shareCopyFailed]);

  const makeUploadPlaceholder = (file, pointId) => ({
    id: makeId('uploading_photo'),
    name: file.name || 'image',
    url: '',
    pathname: '',
    thumbnailUrl: '',
    thumbnailPathname: '',
    contentType: file.type || '',
    width: null,
    height: null,
    uploadState: 'uploading',
    uploadProgress: 0,
    uploadError: '',
    uploadPointId: pointId,
  });

  const handleAddPoint = () => {
    if (!selectedUserId || !users.some((user) => user.id === selectedUserId)) {
      setFormMessage(text.needUserSelect);
      return;
    }

    const latitude = Number.parseFloat(latitudeInput);
    const longitude = Number.parseFloat(longitudeInput);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setFormMessage(text.invalidCoord);
      return;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setFormMessage(text.invalidCoordRange);
      return;
    }

    const pointId = makeId('point');
    const imageFiles = addPointFiles.filter((file) => file?.type?.startsWith('image/'));
    const oversizedFiles = imageFiles.filter((file) => file.size > MAX_UPLOAD_FILE_MB * 1024 * 1024);
    const allowedFiles = imageFiles.filter((file) => file.size <= MAX_UPLOAD_FILE_MB * 1024 * 1024);
    const candidateFiles = allowedFiles.slice(0, MAX_PHOTO_COUNT_PER_POINT);
    const placeholderPhotos = candidateFiles.map((file) => makeUploadPlaceholder(file, pointId));
    let nextMessage = '';
    if (oversizedFiles.length > 0) {
      nextMessage = text.photoTooLargeError;
    } else if (allowedFiles.length > MAX_PHOTO_COUNT_PER_POINT) {
      nextMessage = text.photoCountLimitError;
    }

    const point = {
      id: pointId,
      userId: selectedUserId,
      place: placeInput.trim(),
      latitude,
      longitude,
      route: routeInput.trim(),
      photos: placeholderPhotos,
      featuredPhotoId: null,
      noFeatured: false,
    };

    setPoints((previous) => [...previous, point]);
    addToSearchHistory({
      name: point.place || `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`,
      latitude: point.latitude,
      longitude: point.longitude,
    });
    setSelectedPointId(point.id);
    setFormMessage(nextMessage);
    setPlaceInput('');
    setLatitudeInput('');
    setLongitudeInput('');
    setRouteInput('');
    setAddPointFiles([]);
    if (addPointFileInputRef.current) {
      addPointFileInputRef.current.value = '';
    }
    setCityQuery('');
    setSearchResults([]);
    setIsAddingPoint(false);

    if (candidateFiles.length > 0) {
      enqueuePhotoUploads(pointId, candidateFiles, placeholderPhotos.map((photo) => photo.id));
    }
  };

  const updatePoint = (pointId, updates) => {
    setPoints((previous) => previous.map((point) => (
      point.id === pointId
        ? { ...point, ...updates }
        : point
    )));
  };

  const deletePoint = (pointId) => {
    const point = points.find((item) => item.id === pointId);
    if (!point) {
      return;
    }

    const pointLabel = point.place || `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`;
    const shouldDelete = confirmDangerAction(
      `${text.deletePointConfirm}\n"${pointLabel}"`,
      `${text.dangerSecondConfirm}\n"${pointLabel}"`,
    );
    if (!shouldDelete) {
      return;
    }

    const photoIds = new Set((Array.isArray(point.photos) ? point.photos : []).map((photo) => photo.id));
    dropQueuedUploads((job) => job.pointId === pointId || photoIds.has(job.photoId));
    photoIds.forEach((photoId) => dropFailedUpload(photoId));

    pushRecycleItem({
      kind: 'point',
      title: pointLabel,
      payload: { point },
    });

    setPoints((previous) => previous.filter((point) => point.id !== pointId));
    setSelectedPointId((previous) => (previous === pointId ? '' : previous));
  };

  const uploadMapPhoto = async (file, pointId) => {
    const compressed = await compressImageFile(file);

    if (!activeUserId) {
      const fullUrl = await blobToDataUrl(compressed.fullBlob);
      const thumbUrl = await blobToDataUrl(compressed.thumbBlob);
      return {
        id: compressed.id,
        name: compressed.name,
        width: compressed.width,
        height: compressed.height,
        url: fullUrl,
        pathname: '',
        thumbnailUrl: thumbUrl,
        thumbnailPathname: '',
        contentType: file.type || '',
      };
    }

    const safeFilename = sanitizeFilename(file.name || 'image.jpg');
    const stamp = Date.now();
    const pathname = `attachments/${activeUserId}/map/${pointId}/${stamp}-${safeFilename}`;
    const thumbPathname = `attachments/${activeUserId}/map/${pointId}/${stamp}-thumb-${safeFilename}`;
    const [blob, thumbBlob] = await Promise.all([
      upload(pathname, compressed.fullBlob, {
        access: 'private',
        handleUploadUrl: '/api/attachments?action=upload',
        clientPayload: JSON.stringify({
          targetUserId: activeUserId,
          planId: `map_${pointId}`,
        }),
        multipart: compressed.fullBlob.size > 5 * 1024 * 1024,
      }),
      upload(thumbPathname, compressed.thumbBlob, {
        access: 'private',
        handleUploadUrl: '/api/attachments?action=upload',
        clientPayload: JSON.stringify({
          targetUserId: activeUserId,
          planId: `map_${pointId}`,
        }),
        multipart: false,
      }),
    ]);

    return {
      id: compressed.id,
      name: compressed.name,
      width: compressed.width,
      height: compressed.height,
      url: blob.url,
      pathname: blob.pathname || pathname,
      thumbnailUrl: thumbBlob.url,
      thumbnailPathname: thumbBlob.pathname || thumbPathname,
      contentType: blob.contentType || compressed.fullBlob.type || file.type || '',
    };
  };

  const runUploadQueue = useCallback(async () => {
    if (uploadRunnerActiveRef.current) {
      return;
    }
    uploadRunnerActiveRef.current = true;

    while (uploadQueueRef.current.length > 0) {
      const job = uploadQueueRef.current.shift();
      if (!job) {
        break;
      }
      if (job.workspaceKey && job.workspaceKey !== activeWorkspaceKeyRef.current) {
        setUploadQueueStatus((previous) => ({
          ...previous,
          total: Math.max(0, previous.total - 1),
          active: Math.max(0, previous.active - 1),
        }));
        continue;
      }

      setPoints((previous) => previous.map((point) => {
        if (point.id !== job.pointId) {
          return point;
        }
        return {
          ...point,
          photos: point.photos.map((photo) => (
            photo.id === job.photoId
              ? { ...photo, uploadState: 'uploading', uploadProgress: 12, uploadError: '' }
              : photo
          )),
        };
      }));

      try {
        const uploadedPhoto = await uploadMapPhoto(job.file, job.pointId);
        failedUploadFileRef.current.delete(job.photoId);

        setPoints((previous) => previous.map((point) => {
          if (point.id !== job.pointId) {
            return point;
          }
          const nextPhotos = point.photos.map((photo) => (
            photo.id === job.photoId
              ? {
                  ...uploadedPhoto,
                  id: job.photoId,
                  uploadState: 'ready',
                  uploadProgress: 100,
                  uploadError: '',
                }
              : photo
          ));
          const hasFeatured = nextPhotos.some((photo) => photo.id === point.featuredPhotoId);
          return {
            ...point,
            photos: nextPhotos,
            featuredPhotoId: hasFeatured ? point.featuredPhotoId : (
              !point.featuredPhotoId && nextPhotos.filter((photo) => isNonEmpty(photo.url)).length === 1
                ? nextPhotos.find((photo) => isNonEmpty(photo.url))?.id || null
                : point.featuredPhotoId
            ),
          };
        }));

        setUploadQueueStatus((previous) => ({
          ...previous,
          completed: previous.completed + 1,
          active: Math.max(0, previous.active - 1),
        }));
      } catch (error) {
        failedUploadFileRef.current.set(job.photoId, {
          pointId: job.pointId,
          file: job.file,
        });

        setPoints((previous) => previous.map((point) => {
          if (point.id !== job.pointId) {
            return point;
          }
          return {
            ...point,
            photos: point.photos.map((photo) => (
              photo.id === job.photoId
                ? {
                    ...photo,
                    uploadState: 'failed',
                    uploadProgress: 0,
                    uploadError: error?.message || text.photoReadError,
                  }
                : photo
            )),
          };
        }));

        setUploadQueueStatus((previous) => ({
          ...previous,
          failed: previous.failed + 1,
          active: Math.max(0, previous.active - 1),
        }));
      }
    }

    uploadRunnerActiveRef.current = false;
  }, [text.photoReadError, uploadMapPhoto]);

  const enqueuePhotoUploads = useCallback((pointId, files, placeholderIds) => {
    const jobs = files.map((file, index) => ({
      pointId,
      file,
      photoId: placeholderIds[index],
      workspaceKey: activeWorkspaceKeyRef.current || '',
    })).filter((job) => isNonEmpty(job.photoId));

    if (!jobs.length) {
      return;
    }

    uploadQueueRef.current.push(...jobs);
    setUploadQueueStatus((previous) => ({
      ...previous,
      total: previous.total + jobs.length,
      active: previous.active + jobs.length,
    }));
    runUploadQueue();
  }, [runUploadQueue]);

  const retryPhotoUpload = (pointId, photoId) => {
    const failedItem = failedUploadFileRef.current.get(photoId);
    if (!failedItem || !failedItem.file) {
      return;
    }
    failedUploadFileRef.current.delete(photoId);
    setUploadQueueStatus((previous) => ({
      ...previous,
      failed: Math.max(0, previous.failed - 1),
      active: previous.active + 1,
    }));
    setPoints((previous) => previous.map((point) => {
      if (point.id !== pointId) {
        return point;
      }
      return {
        ...point,
        photos: point.photos.map((photo) => (
          photo.id === photoId
            ? { ...photo, uploadState: 'uploading', uploadProgress: 0, uploadError: '' }
            : photo
        )),
      };
    }));
    uploadQueueRef.current.push({
      pointId: failedItem.pointId || pointId,
      photoId,
      file: failedItem.file,
      workspaceKey: activeWorkspaceKeyRef.current || '',
    });
    runUploadQueue();
  };

  const retryAllFailedUploads = () => {
    const entries = Array.from(failedUploadFileRef.current.entries());
    if (!entries.length) {
      return;
    }

    const jobs = entries
      .map(([photoId, value]) => ({
        pointId: value?.pointId,
        photoId,
        file: value?.file,
        workspaceKey: activeWorkspaceKeyRef.current || '',
      }))
      .filter((job) => job.pointId && job.file);
    if (!jobs.length) {
      return;
    }

    failedUploadFileRef.current.clear();
    setUploadQueueStatus((previous) => ({
      ...previous,
      failed: Math.max(0, previous.failed - jobs.length),
      active: previous.active + jobs.length,
    }));

    setPoints((previous) => previous.map((point) => {
      const jobIds = new Set(jobs.filter((job) => job.pointId === point.id).map((job) => job.photoId));
      if (!jobIds.size) {
        return point;
      }
      return {
        ...point,
        photos: point.photos.map((photo) => (
          jobIds.has(photo.id)
            ? { ...photo, uploadState: 'uploading', uploadProgress: 0, uploadError: '' }
            : photo
        )),
      };
    }));

    uploadQueueRef.current.push(...jobs);
    runUploadQueue();
  };

  const dropQueuedUploads = useCallback((predicate) => {
    const previousLength = uploadQueueRef.current.length;
    uploadQueueRef.current = uploadQueueRef.current.filter((job) => !predicate(job));
    const removedCount = previousLength - uploadQueueRef.current.length;
    if (removedCount > 0) {
      setUploadQueueStatus((previous) => ({
        ...previous,
        total: Math.max(0, previous.total - removedCount),
        active: Math.max(0, previous.active - removedCount),
      }));
    }
  }, []);

  const dropFailedUpload = useCallback((photoId) => {
    if (!photoId) {
      return;
    }
    if (failedUploadFileRef.current.delete(photoId)) {
      setUploadQueueStatus((previous) => ({
        ...previous,
        total: Math.max(0, previous.total - 1),
        failed: Math.max(0, previous.failed - 1),
      }));
    }
  }, []);

  const uploadPhotos = (pointId, fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) {
      return;
    }

    const oversizedFiles = files.filter((file) => file.size > MAX_UPLOAD_FILE_MB * 1024 * 1024);
    const allowedFiles = files.filter((file) => file.size <= MAX_UPLOAD_FILE_MB * 1024 * 1024);

    if (!allowedFiles.length) {
      setFormMessage(text.photoTooLargeError);
      return;
    }

    const currentPoint = points.find((point) => point.id === pointId);
    if (!currentPoint) {
      return;
    }

    const restSlots = Math.max(0, MAX_PHOTO_COUNT_PER_POINT - currentPoint.photos.length);
    if (restSlots <= 0) {
      setFormMessage(text.photoCountLimitError);
      return;
    }

    const candidateFiles = allowedFiles.slice(0, restSlots);
    const placeholderPhotos = candidateFiles.map((file) => makeUploadPlaceholder(file, pointId));

    setPoints((previous) => previous.map((point) => {
      if (point.id !== pointId) {
        return point;
      }
      return {
        ...point,
        photos: [...point.photos, ...placeholderPhotos],
      };
    }));

    if (oversizedFiles.length > 0) {
      setFormMessage(text.photoTooLargeError);
    } else if (allowedFiles.length > restSlots) {
      setFormMessage(text.photoCountLimitError);
    } else {
      setFormMessage('');
    }

    if (candidateFiles.length > 0) {
      enqueuePhotoUploads(pointId, candidateFiles, placeholderPhotos.map((photo) => photo.id));
    }
  };

  const setFeaturedPhoto = (pointId, photoId) => {
    setPoints((previous) => previous.map((point) => (
      point.id === pointId
        ? {
            ...point,
            featuredPhotoId: photoId,
            noFeatured: false,
          }
        : point
    )));
  };

  const clearFeaturedPhoto = (pointId) => {
    setPoints((previous) => previous.map((point) => (
      point.id === pointId
        ? {
            ...point,
            featuredPhotoId: null,
            noFeatured: true,
          }
        : point
    )));
  };

  const deletePhoto = async (pointId, photoId) => {
    const point = points.find((item) => item.id === pointId);
    const photo = point?.photos?.find((item) => item.id === photoId);
    if (!photo) {
      return;
    }
    const photoLabel = photo?.name || text.photosTitle;
    const shouldDelete = confirmDangerAction(
      `${text.deletePhotoConfirm}\n"${photoLabel}"`,
      `${text.dangerSecondConfirm}\n"${photoLabel}"`,
    );
    if (!shouldDelete) {
      return;
    }

    dropQueuedUploads((job) => job.photoId === photoId);
    dropFailedUpload(photoId);

    pushRecycleItem({
      kind: 'photo',
      title: photoLabel,
      payload: {
        pointId,
        photo,
      },
    });

    setPoints((previous) => previous.map((point) => {
      if (point.id !== pointId) {
        return point;
      }

      const nextPhotos = point.photos.filter((photo) => photo.id !== photoId);
      if (nextPhotos.length === 0) {
        return {
          ...point,
          photos: [],
          featuredPhotoId: null,
          noFeatured: false,
        };
      }

      let featuredPhotoId = point.featuredPhotoId;
      if (featuredPhotoId === photoId) {
        featuredPhotoId = null;
      }

      if (!featuredPhotoId && nextPhotos.length === 1 && !point.noFeatured) {
        featuredPhotoId = nextPhotos[0].id;
      }

      return {
        ...point,
        photos: nextPhotos,
        featuredPhotoId,
      };
    }));
  };

  const hardDeleteRecycleItem = (itemId) => {
    const target = recycleBin.find((item) => item.id === itemId);
    if (!target) {
      return;
    }
    if (target.kind === 'photo') {
      cleanupPhotoStorage(target.payload?.photo);
    } else if (target.kind === 'point') {
      const photos = Array.isArray(target.payload?.point?.photos) ? target.payload.point.photos : [];
      photos.forEach((photo) => cleanupPhotoStorage(photo));
    }
    setRecycleBin((previous) => previous.filter((item) => item.id !== itemId));
  };

  const restoreRecycleItem = (itemId) => {
    const target = recycleBin.find((item) => item.id === itemId);
    if (!target) {
      return;
    }

    if (target.kind === 'point') {
      const rawPoint = target.payload?.point;
      if (!rawPoint) {
        setRecycleBin((previous) => previous.filter((item) => item.id !== itemId));
        return;
      }
      const ownerId = users.some((user) => user.id === rawPoint.userId)
        ? rawPoint.userId
        : (selectedUserId || users[0]?.id || '');
      const restoredPoint = { ...rawPoint, userId: ownerId };
      setPoints((previous) => (previous.some((point) => point.id === restoredPoint.id)
        ? previous
        : [...previous, restoredPoint]));
      setSelectedPointId(restoredPoint.id);
    }

    if (target.kind === 'photo') {
      const targetPointId = target.payload?.pointId;
      const photo = target.payload?.photo;
      if (targetPointId && photo) {
        setPoints((previous) => previous.map((point) => {
          if (point.id !== targetPointId) {
            return point;
          }
          if (point.photos.some((item) => item.id === photo.id)) {
            return point;
          }
          const mergedPhotos = [...point.photos, photo];
          return {
            ...point,
            photos: mergedPhotos,
            featuredPhotoId: point.featuredPhotoId || (mergedPhotos.length === 1 ? photo.id : null),
            noFeatured: mergedPhotos.length > 0 ? point.noFeatured : false,
          };
        }));
      }
    }

    if (target.kind === 'user') {
      const restoredUser = target.payload?.user;
      const fallbackUserId = target.payload?.fallbackUserId;
      const movedPointIds = Array.isArray(target.payload?.movedPointIds) ? target.payload.movedPointIds : [];
      if (restoredUser && !users.some((user) => user.id === restoredUser.id)) {
        setUsers((previous) => [...previous, restoredUser]);
      }
      if (restoredUser) {
        setSelectedUserId(restoredUser.id);
        setExpandedUserId(restoredUser.id);
      }
      if (restoredUser && fallbackUserId) {
        setPoints((previous) => previous.map((point) => (
          movedPointIds.includes(point.id) && point.userId === fallbackUserId
            ? { ...point, userId: restoredUser.id }
            : point
        )));
      }
    }

    setRecycleBin((previous) => previous.filter((item) => item.id !== itemId));
  };

  const recycleItemLabel = (item) => {
    if (item.kind === 'photo') {
      return text.recyclePhotoLabel;
    }
    if (item.kind === 'user') {
      return text.recycleUserLabel;
    }
    return text.recyclePointLabel;
  };
  const currentShareUrl = shareUrl || (shareEnabled ? buildClientShareUrl(shareToken) : '');

  return (
    <section className="glass-panel map-view-root">
      <header className="map-view-header">
        {readOnly && (
          <div className="map-readonly-banner">
            {text.readOnlyBanner}
            {sharedOwnerName ? ` · ${sharedOwnerName}` : ''}
          </div>
        )}
        <div className="map-view-actions">
          <div className="map-scope-toggle">
            <button
              type="button"
              className={`glass-button map-topbar-btn map-scope-btn ${scope === 'china' ? 'active' : ''}`}
              onClick={() => setScope('china')}
            >
              {text.chinaScope}
            </button>
            <button
              type="button"
              className={`glass-button map-topbar-btn map-scope-btn ${scope === 'world' ? 'active' : ''}`}
              onClick={() => setScope('world')}
            >
              {text.worldScope}
            </button>
          </div>

          <button
            type="button"
            className="glass-button map-topbar-btn map-featured-toggle-btn"
            onClick={() => setShowFeaturedBubbles((previous) => !previous)}
          >
            {showFeaturedBubbles ? text.featuredBubbleHide : text.featuredBubbleShow}
          </button>

          <label className="map-layout-select-wrap">
            <span>{text.featuredLayoutLabel}</span>
            <select
              value={bubbleLayout}
              onChange={(event) => setBubbleLayout(event.target.value)}
              className="map-layout-select"
            >
              <option value="map">{text.featuredLayoutMap}</option>
              <option value="right">{text.featuredLayoutRight}</option>
              <option value="bottom">{text.featuredLayoutBottom}</option>
            </select>
          </label>

          {!readOnly && (
            <button
              type="button"
              className={`glass-button map-topbar-btn ${isSharePanelOpen ? 'active' : ''}`}
              onClick={() => setIsSharePanelOpen((previous) => !previous)}
            >
              {text.shareManageBtn}
            </button>
          )}

          {!readOnly && (
            <button type="button" className="glass-button map-topbar-btn" onClick={onBackToSchedule}>
              {text.backToSchedule}
            </button>
          )}
        </div>
      </header>
      {!readOnly && isSharePanelOpen && (
        <div
          className="map-share-modal-backdrop"
          onClick={() => setIsSharePanelOpen(false)}
        >
          <section
            className="map-header-share-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="map-header-share-panel-head">
              <strong>{text.shareManageBtn}</strong>
              <button
                type="button"
                className="glass-button map-topbar-btn"
                onClick={() => setIsSharePanelOpen(false)}
              >
                {text.shareCloseBtn}
              </button>
            </div>
            {!shareEnabled && (
              <button
                type="button"
                className="glass-button map-topbar-btn"
                onClick={() => updateShareSetting('enable')}
                disabled={isShareBusy}
              >
                {isShareBusy ? text.shareBusyLabel : text.shareEnableBtn}
              </button>
            )}
            {shareEnabled && (
              <>
                <div className="map-header-share-inline">
                  <span className="map-header-share-link" title={currentShareUrl}>
                    {currentShareUrl}
                  </span>
                  <button
                    type="button"
                    className="glass-button map-header-share-copy-btn"
                    onClick={copyShareLink}
                    disabled={isShareBusy || !currentShareUrl}
                    aria-label={text.shareCopyBtn}
                    title={text.shareCopyBtn}
                  >
                    ⧉
                  </button>
                </div>
                <div className="map-header-share-panel-actions">
                  <button
                    type="button"
                    className="glass-button map-topbar-btn"
                    onClick={() => updateShareSetting('regenerate')}
                    disabled={isShareBusy}
                  >
                    {isShareBusy ? text.shareBusyLabel : text.shareRegenerateBtn}
                  </button>
                  <button
                    type="button"
                    className="glass-button map-topbar-btn map-danger-btn"
                    onClick={() => updateShareSetting('disable')}
                    disabled={isShareBusy}
                  >
                    {isShareBusy ? text.shareBusyLabel : text.shareDisableBtn}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <div className="map-view-layout">
        <aside className="map-sidebar">
          <section className="map-panel">
            <div className="map-user-panel-head">
              {!readOnly && (
                <button
                  type="button"
                  className="glass-button map-user-edit-toggle-btn"
                  onClick={() => setIsUserEditExpanded((previous) => !previous)}
                  disabled={!selectedUser}
                >
                  {text.userEditBtn}
                </button>
              )}
            </div>
            <ul className="map-user-list">
              {users.map((user) => {
                const markerCount = markerCountByUser[user.id] || 0;
                const isExpanded = expandedUserId === user.id;
                return (
                  <li
                    key={user.id}
                    className={`map-user-item ${selectedUserId === user.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setExpandedUserId((previous) => (previous === user.id ? '' : user.id));
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedUserId(user.id);
                        setExpandedUserId((previous) => (previous === user.id ? '' : user.id));
                      }
                    }}
                  >
                    <span className="map-user-dot" style={{ backgroundColor: user.color }} />
                    <span className="map-user-name">{user.name}</span>
                    <span className="map-user-count">
                      {markerCount} {text.userPointsLabel} {isExpanded ? '▾' : '▸'}
                    </span>
                  </li>
                );
              })}
            </ul>

            {expandedUserId && (
              <div className="map-user-places-box">
                <p className="map-label">{text.userPlacesTitle}</p>
                {expandedUserPoints.length === 0 && <p className="map-muted">{text.noUserPlaces}</p>}
                {expandedUserPoints.length > 0 && (
                  <ul className="map-user-places-list">
                    {expandedUserPoints.map((point) => (
                      <li key={`user_place_${point.id}`}>
                        <span className="map-user-place-name">
                          {point.place || `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`}
                        </span>
                        <div className="map-user-place-actions">
                          <button
                            type="button"
                            className="glass-button"
                            onClick={() => handleEditPointFromUserList(point.id)}
                          >
                            {text.placeEditBtn}
                          </button>
                          {!readOnly && (
                            <button
                              type="button"
                              className="glass-button map-danger-btn"
                              onClick={() => deletePoint(point.id)}
                            >
                              {text.placeDeleteBtn}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {!readOnly && isUserEditExpanded && (
              <div className="map-user-edit-box">
                <label className="map-label" htmlFor="map_edit_user_name">{text.editUserTitle}</label>
                <input
                  id="map_edit_user_name"
                  className="glass-input"
                  value={editUserName}
                  placeholder={text.editUserNamePlaceholder}
                  onChange={(event) => setEditUserName(event.target.value)}
                  disabled={!selectedUser}
                />
                <div className="map-inline-grid">
                  <div>
                    <label className="map-label" htmlFor="map_edit_user_color_hex">{text.colorHexLabel}</label>
                    <input
                      id="map_edit_user_color_hex"
                      type="color"
                      className="map-color-input"
                      value={editUserColor}
                      onChange={(event) => {
                        setEditUserColor(event.target.value);
                        setEditUserRgb(hexToRgbString(event.target.value));
                        setFormMessage('');
                      }}
                      disabled={!selectedUser}
                    />
                  </div>
                  <div>
                    <label className="map-label" htmlFor="map_edit_user_color_rgb">{text.colorRgbLabel}</label>
                    <input
                      id="map_edit_user_color_rgb"
                      className="glass-input"
                      value={editUserRgb}
                      onChange={(event) => handleEditRgbChange(event.target.value)}
                      disabled={!selectedUser}
                    />
                  </div>
                </div>
                <div className="map-user-edit-actions">
                  <button
                    type="button"
                    className="glass-button map-user-edit-action-btn"
                    onClick={handleRenameUser}
                    disabled={!selectedUser}
                  >
                    {text.updateUserBtn}
                  </button>
                  <button
                    type="button"
                    className="glass-button map-danger-btn map-user-edit-action-btn"
                    onClick={handleDeleteUser}
                    disabled={!selectedUser || users.length <= 1}
                  >
                    {text.deleteUserBtn}
                  </button>
                </div>
              </div>
            )}
          </section>

          {!readOnly && (
            <section className="map-panel">
              <button
                type="button"
                className="glass-button map-collapse-btn"
                onClick={() => setIsAddUserExpanded((previous) => !previous)}
                aria-expanded={isAddUserExpanded}
              >
                <span>{text.addUserTitle}</span>
                <span className="map-collapse-indicator">{isAddUserExpanded ? '−' : '+'}</span>
              </button>

              {isAddUserExpanded && (
                <div className="map-collapsible-body">
                  <label className="map-label" htmlFor="map_user_name">{text.addUserName}</label>
                  <input
                    id="map_user_name"
                    className="glass-input"
                    value={newUserName}
                    placeholder={text.addUserNamePlaceholder}
                    onChange={(event) => setNewUserName(event.target.value)}
                  />

                  <div className="map-inline-grid">
                    <div>
                      <label className="map-label" htmlFor="map_user_color_hex">{text.colorHexLabel}</label>
                      <input
                        id="map_user_color_hex"
                        type="color"
                        className="map-color-input"
                        value={newUserColor}
                        onChange={(event) => {
                          setNewUserColor(event.target.value);
                          setNewUserRgb(hexToRgbString(event.target.value));
                        }}
                      />
                    </div>
                    <div>
                      <label className="map-label" htmlFor="map_user_color_rgb">{text.colorRgbLabel}</label>
                      <input
                        id="map_user_color_rgb"
                        className="glass-input"
                        value={newUserRgb}
                        onChange={(event) => handleNewRgbChange(event.target.value)}
                      />
                    </div>
                  </div>

                  <button type="button" className="glass-button map-block-btn" onClick={handleAddUser}>
                    {text.addUserBtn}
                  </button>
                </div>
              )}
            </section>
          )}

          {!readOnly && (
            <section className="map-panel">
            <h3>{text.cityTitle}</h3>
            <label className="map-label" htmlFor="map_city_search">{text.cityInputLabel}</label>
            <div className="map-search-row">
              <input
                id="map_city_search"
                className="glass-input"
                value={cityQuery}
                placeholder={text.cityInputPlaceholder}
                onChange={(event) => setCityQuery(event.target.value)}
              />
              <button type="button" className="glass-button" onClick={handleSearchCity} disabled={isSearching}>
                {isSearching ? text.citySearching : text.citySearchBtn}
              </button>
            </div>

            <button
              type="button"
              className="glass-button"
              onClick={saveCurrentPlaceToFavorites}
            >
              {text.saveCurrentPlaceBtn}
            </button>

            {localMatchPlaces.length > 0 && (
              <>
                <p className="map-label">{text.localMatchTitle}</p>
                <div className="map-place-chip-list">
                  {localMatchPlaces.map((place) => (
                    <button
                      key={`local_match_${place.id}`}
                      type="button"
                      className="glass-button map-place-chip"
                      onClick={() => applyQuickPlace(place)}
                    >
                      {place.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            {searchResults.length > 0 && (
              <div className="map-search-results">
                {searchResults.map((result) => (
                  <div key={result.id} className="map-search-result-row">
                    <button
                      type="button"
                      className="map-search-result map-search-result-main"
                      onClick={() => applySearchResult(result)}
                    >
                      <span>{result.name}</span>
                      <small>{result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}</small>
                    </button>
                    <button
                      type="button"
                      className="glass-button map-search-fav-btn"
                      onClick={() => toggleFavoritePlace(placeFromResult(result))}
                    >
                      {isFavoritePlace(result) ? text.removeFavoriteBtn : text.addFavoriteBtn}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="map-label">{text.favoritePlacesTitle}</p>
            {favoritePlaces.length === 0 && <p className="map-muted">{text.noFavoritePlaces}</p>}
            {favoritePlaces.length > 0 && (
              <div className="map-place-chip-list">
                {favoritePlaces.map((place) => (
                  <button
                    key={`fav_place_${place.id}`}
                    type="button"
                    className="glass-button map-place-chip"
                    onClick={() => applyQuickPlace(place)}
                  >
                    {place.name}
                  </button>
                ))}
              </div>
            )}

            <p className="map-label">{text.searchHistoryTitle}</p>
            {searchHistory.length === 0 && <p className="map-muted">{text.noSearchHistory}</p>}
            {searchHistory.length > 0 && (
              <div className="map-place-chip-list">
                {searchHistory.map((place) => (
                  <button
                    key={`history_place_${place.id}`}
                    type="button"
                    className="glass-button map-place-chip"
                    onClick={() => applyQuickPlace(place)}
                  >
                    {place.name}
                  </button>
                ))}
              </div>
            )}

            <label className="map-label" htmlFor="map_place_input">{text.placeLabel}</label>
            <input
              id="map_place_input"
              className="glass-input"
              value={placeInput}
              placeholder={text.placePlaceholder}
              onChange={(event) => setPlaceInput(event.target.value)}
            />

            <div className="map-inline-grid">
              <div>
                <label className="map-label" htmlFor="map_latitude">{text.latitudeLabel}</label>
                <input
                  id="map_latitude"
                  className="glass-input"
                  value={latitudeInput}
                  onChange={(event) => setLatitudeInput(event.target.value)}
                />
              </div>
              <div>
                <label className="map-label" htmlFor="map_longitude">{text.longitudeLabel}</label>
                <input
                  id="map_longitude"
                  className="glass-input"
                  value={longitudeInput}
                  onChange={(event) => setLongitudeInput(event.target.value)}
                />
              </div>
            </div>

            <label className="map-label" htmlFor="map_route_input">{text.routeLabel}</label>
            <textarea
              id="map_route_input"
              className="glass-input map-textarea"
              value={routeInput}
              placeholder={text.routePlaceholder}
              onChange={(event) => setRouteInput(event.target.value)}
            />

            <label className="map-upload-label" htmlFor="map_add_point_photos">{text.uploadPhotosLabel}</label>
            <input
              ref={addPointFileInputRef}
              id="map_add_point_photos"
              type="file"
              accept="image/*"
              multiple
              className="glass-input map-file-input"
              onChange={(event) => {
                setAddPointFiles(Array.from(event.target.files || []));
              }}
            />
            {addPointFiles.length > 0 && (
              <p className="map-muted">
                {language === 'zh'
                  ? `已选择 ${addPointFiles.length} 张图片`
                  : `${addPointFiles.length} image(s) selected`}
              </p>
            )}

            <button
              type="button"
              className="glass-button map-block-btn"
              onClick={handleAddPoint}
              disabled={isAddingPoint}
            >
              {isAddingPoint ? text.addPointSaving : text.addPointBtn}
            </button>
            </section>
          )}

          <section className="map-panel">
            <h3>{text.markersTitle} ({points.length} {text.markerCountLabel})</h3>
            {points.length === 0 && <p className="map-muted">{text.markersEmpty}</p>}
            {points.length > 0 && (
              <ul className="map-marker-list">
                {points.map((point) => {
                  const owner = userMap.get(point.userId);
                  return (
                    <li
                      key={point.id}
                      className={selectedPointId === point.id ? 'active' : ''}
                      onClick={() => setSelectedPointId(point.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedPointId(point.id);
                        }
                      }}
                    >
                      <span className="map-user-dot" style={{ backgroundColor: owner?.color || '#94a3b8' }} />
                      <span className="map-marker-place">{point.place || `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`}</span>
                      <span className="map-marker-owner">{owner?.name || '-'}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {!readOnly && (
            <section className="map-panel">
              <h3>{text.recycleBinTitle} ({recycleBin.length})</h3>
              <p className="map-muted">{text.recycleBinHint}</p>
              {recycleBin.length === 0 && <p className="map-muted">{text.recycleBinEmpty}</p>}
              {recycleBin.length > 0 && (
                <ul className="map-user-places-list">
                  {recycleBin.map((item) => (
                    <li key={item.id}>
                      <span className="map-user-place-name" title={item.title || recycleItemLabel(item)}>
                        {recycleItemLabel(item)}: {item.title || '-'}
                        {' '}
                        ({text.recycleDeletedAt} {new Date(item.deletedAt).toLocaleString()})
                      </span>
                      <div className="map-user-place-actions">
                        <button
                          type="button"
                          className="glass-button"
                          onClick={() => restoreRecycleItem(item.id)}
                        >
                          {text.recycleRestoreBtn}
                        </button>
                        <button
                          type="button"
                          className="glass-button map-danger-btn"
                          onClick={() => hardDeleteRecycleItem(item.id)}
                        >
                          {text.recycleDeleteBtn}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {!readOnly && (uploadQueueStatus.active > 0 || uploadQueueStatus.failed > 0) && (
            <section className="map-panel">
              <h3>{text.uploadQueueTitle}</h3>
              <p className="map-muted">
                {uploadProcessedCount}/{uploadQueueStatus.total} · {uploadProgressPercent}%
              </p>
              <div className="map-upload-progress-track">
                <span
                  className="map-upload-progress-fill"
                  style={{ width: `${uploadProgressPercent}%` }}
                />
              </div>
              <p className="map-muted">
                {text.uploadingLabel} {uploadQueueStatus.active}
                {' · '}
                {text.uploadFailedLabel} {uploadQueueStatus.failed}
              </p>
              {uploadQueueStatus.failed > 0 && (
                <button
                  type="button"
                  className="glass-button"
                  onClick={retryAllFailedUploads}
                >
                  {text.retryAllFailedBtn}
                </button>
              )}
            </section>
          )}

          {(formMessage || searchMessage) && (
            <div className="map-message-box">
              {formMessage && <p>{formMessage}</p>}
              {searchMessage && <p>{searchMessage}</p>}
            </div>
          )}
        </aside>

        <div className="map-canvas-column" ref={mapCanvasColumnRef}>
          {showFeaturedBubbles && bubbleLayout !== 'map' && dockLines.length > 0 && (
            <svg
              className={`map-dock-connectors map-dock-connectors-${bubbleLayout}`}
              xmlns="http://www.w3.org/2000/svg"
            >
              {dockLines.map((line) => (
                <line
                  key={`dock_line_${line.id}`}
                  x1={line.startX}
                  y1={line.startY}
                  x2={line.endX}
                  y2={line.endY}
                  stroke={line.color}
                  strokeWidth="2"
                  strokeOpacity="0.78"
                  strokeDasharray="6 6"
                />
              ))}
            </svg>
          )}

          <div className="map-canvas-shell">
            <div className="map-canvas-headline">
              {scope === 'china' ? text.chinaScope : text.worldScope}
            </div>
            <MapContainer
              className="map-canvas"
              center={CHINA_VIEW.center}
              zoom={CHINA_VIEW.zoom}
              scrollWheelZoom
              preferCanvas
              maxBoundsViscosity={0.86}
              minZoom={scope === 'china' ? CHINA_VIEW.minZoom : WORLD_VIEW.minZoom}
              whenReady={(event) => setMapInstance(event.target)}
            >
              <MapViewportController scope={scope} />
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
              />

              {showFeaturedBubbles && bubbleLayout === 'map' && featuredPoints.map(({ point, owner, featuredPhoto }) => {
                const bubbleSize = getPhotoBubbleSize(featuredPhoto);
                return (
                  <Marker
                    key={`featured_bubble_${point.id}`}
                    position={[point.latitude, point.longitude]}
                    icon={FEATURED_BUBBLE_ANCHOR_ICON}
                    interactive={false}
                    keyboard={false}
                  >
                    <Tooltip
                      permanent
                      direction="right"
                      offset={[20, -10]}
                      opacity={1}
                      className="map-featured-photo-tooltip"
                    >
                      <div
                        className="map-featured-photo-bubble"
                        style={{
                          '--bubble-accent': owner?.color || '#38bdf8',
                          width: `${bubbleSize.width}px`,
                          height: `${bubbleSize.height}px`,
                        }}
                      >
                        <img
                          src={resolvePhotoSrc(featuredPhoto, activeUserId, { preferThumbnail: true })}
                          alt={featuredPhoto.name || text.featuredPhotoAlt}
                          loading="lazy"
                        />
                      </div>
                    </Tooltip>
                  </Marker>
                );
              })}

              {visiblePoints.map((point) => {
                const owner = userMap.get(point.userId);
                const markerColor = owner?.color || '#64748b';
                const isSelectedMarker = selectedPointId === point.id;

                return (
                  <CircleMarker
                    key={point.id}
                    center={[point.latitude, point.longitude]}
                    radius={isSelectedMarker ? 12 : 10}
                    eventHandlers={{
                      click: () => setSelectedPointId(point.id),
                    }}
                    pathOptions={{
                      color: markerColor,
                      fillColor: markerColor,
                      fillOpacity: 0.9,
                      weight: isSelectedMarker ? 4 : 3,
                    }}
                  >
                    <Tooltip
                      permanent
                      direction="top"
                      offset={[0, -10]}
                      opacity={0.95}
                      className="map-marker-tooltip"
                    >
                      {owner?.name || '-'}
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>

          {showFeaturedBubbles && bubbleLayout !== 'map' && dockFeaturedPoints.length > 0 && (
            <div
              className={`map-featured-dock map-featured-dock-${bubbleLayout}`}
              ref={featuredDockRef}
            >
              {dockFeaturedPoints.map(({ point, owner, featuredPhoto }) => {
                const bubbleSize = getPhotoBubbleSize(featuredPhoto);
                return (
                  <button
                    key={`dock_item_${point.id}`}
                    type="button"
                    ref={(node) => setDockItemRef(point.id, node)}
                    className={`map-featured-dock-item ${selectedPointId === point.id ? 'active' : ''}`}
                    onClick={() => setSelectedPointId(point.id)}
                    style={{ '--bubble-accent': owner?.color || '#38bdf8' }}
                  >
                    <div
                      className="map-featured-photo-bubble"
                      style={{
                        width: `${bubbleSize.width}px`,
                        height: `${bubbleSize.height}px`,
                      }}
                    >
                      <img
                        src={resolvePhotoSrc(featuredPhoto, activeUserId, { preferThumbnail: true })}
                        alt={featuredPhoto.name || text.featuredPhotoAlt}
                        loading="lazy"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedPoint && (
        <aside ref={bookmarkEditorRef} className="glass-panel map-bookmark-editor-float">
          <div className="map-editor-float-head">
            <strong>{text.editorTitle}</strong>
            <button
              type="button"
              className="glass-button"
              onClick={() => setSelectedPointId('')}
            >
              {text.closeEditorBtn}
            </button>
          </div>
          <MapBookmarkCard
            point={selectedPoint}
            owner={selectedPointOwner}
            ownerId={activeUserId}
            text={text}
            readOnly={readOnly}
            photoSrcResolver={resolvePhotoSrc}
            onUpdatePoint={updatePoint}
            onUploadPhotos={uploadPhotos}
            onSetFeatured={setFeaturedPhoto}
            onClearFeatured={clearFeaturedPhoto}
            onDeletePhoto={deletePhoto}
            onRetryPhoto={retryPhotoUpload}
            onDeletePoint={deletePoint}
          />
        </aside>
      )}
    </section>
  );
}

export default MapView;
