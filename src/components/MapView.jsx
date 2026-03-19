import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
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
const MAX_PHOTO_COUNT_PER_POINT = 24;

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
    deleteUserBtn: 'Delete user',
    cityTitle: 'City / Coordinates',
    cityInputLabel: 'Search city',
    cityInputPlaceholder: 'e.g. Shanghai, London, Tokyo',
    citySearchBtn: 'Search',
    citySearching: 'Searching...',
    placeLabel: 'Place label',
    placePlaceholder: 'Can be city, scenic spot, or custom note',
    latitudeLabel: 'Latitude',
    longitudeLabel: 'Longitude',
    routeLabel: 'Optional route note',
    routePlaceholder: 'Metro line, meeting route, driving plan, etc.',
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
    removePointBtn: 'Remove point',
    photoReadError: 'Some images could not be loaded.',
    photoTooLargeError: `Some images were larger than ${MAX_UPLOAD_FILE_MB}MB and were skipped.`,
    photoCountLimitError: `At most ${MAX_PHOTO_COUNT_PER_POINT} photos can be stored for one point.`,
    storageLimitError: 'Storage limit reached. Reduce photos or clear old points.',
    geocodeError: 'Failed to search city. Try another keyword or enter coordinates manually.',
    noGeocodeResult: 'No city result found.',
    needUserName: 'Please enter a username first.',
    duplicateUserName: 'This username already exists.',
    needUserSelect: 'Please create/select a user first.',
    cannotDeleteLastUser: 'At least one user must be kept.',
    deleteUserConfirm: 'Delete this user?',
    userDeleteReassign: 'Points will be reassigned to',
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
    deleteUserBtn: '删除用户',
    cityTitle: '城市 / 经纬度',
    cityInputLabel: '输入城市',
    cityInputPlaceholder: '例如：上海、北京、London',
    citySearchBtn: '搜索',
    citySearching: '搜索中...',
    placeLabel: '地点名称',
    placePlaceholder: '可填城市、景点或自定义备注',
    latitudeLabel: '纬度',
    longitudeLabel: '经度',
    routeLabel: '路线备注（可选）',
    routePlaceholder: '地铁线路、会面路线、自驾方案等',
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
    removePointBtn: '删除点位',
    photoReadError: '部分图片读取失败，请重试。',
    photoTooLargeError: `部分图片超过 ${MAX_UPLOAD_FILE_MB}MB，已跳过。`,
    photoCountLimitError: `单个点位最多保存 ${MAX_PHOTO_COUNT_PER_POINT} 张图片。`,
    storageLimitError: '本地存储空间不足，请减少图片或清理旧点位。',
    geocodeError: '城市搜索失败，请换关键词或直接输入经纬度。',
    noGeocodeResult: '没有匹配到城市结果。',
    needUserName: '请先输入用户名。',
    duplicateUserName: '该用户名已存在。',
    needUserSelect: '请先创建或选择用户。',
    cannotDeleteLastUser: '至少保留一个用户。',
    deleteUserConfirm: '确认删除该用户吗？',
    userDeleteReassign: '该用户点位将迁移到',
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
  width: Number.isFinite(photo?.width) ? Math.max(1, Math.round(photo.width)) : null,
  height: Number.isFinite(photo?.height) ? Math.max(1, Math.round(photo.height)) : null,
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

const renderCanvasToDataUrl = (canvas, mimeType, quality) => canvas.toDataURL(mimeType, quality);

const compressImageFile = async (file) => {
  const image = await loadImageFromBlob(file);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;

  if (!originalWidth || !originalHeight) {
    throw new Error('Invalid image dimensions');
  }

  const scale = Math.min(1, MAX_CANVAS_EDGE / Math.max(originalWidth, originalHeight));
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
  let url = renderCanvasToDataUrl(canvas, preferredType, quality);

  if (preferredType !== 'image/png') {
    while (url.length > 2_000_000 && quality > 0.58) {
      quality -= 0.08;
      url = renderCanvasToDataUrl(canvas, preferredType, quality);
    }
  }

  return {
    id: makeId('photo'),
    name: file.name,
    url,
    width,
    height,
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

function FeaturedDockLines({ featuredPoints, layout }) {
  const map = useMap();
  const [anchors, setAnchors] = useState([]);

  const recomputeAnchors = useCallback(() => {
    if (!featuredPoints.length) {
      setAnchors([]);
      return;
    }

    const bounds = map.getBounds();
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();
    const latSpan = Math.max(0.000001, north - south);
    const lngSpan = Math.max(0.000001, east - west);
    const nextAnchors = featuredPoints.map((_, index) => {
      const ratio = (index + 1) / (featuredPoints.length + 1);
      if (layout === 'bottom') {
        return {
          lat: south + latSpan * 0.04,
          lng: west + lngSpan * (0.1 + ratio * 0.8),
        };
      }

      return {
        lat: north - latSpan * (0.12 + ratio * 0.76),
        lng: east - lngSpan * 0.03,
      };
    });
    setAnchors(nextAnchors);
  }, [featuredPoints, layout, map]);

  useEffect(() => {
    recomputeAnchors();
    map.on('move zoom resize', recomputeAnchors);
    return () => {
      map.off('move zoom resize', recomputeAnchors);
    };
  }, [map, recomputeAnchors]);

  if (!anchors.length) {
    return null;
  }

  return (
    <>
      {featuredPoints.map((item, index) => {
        const anchor = anchors[index];
        if (!anchor) {
          return null;
        }

        return (
          <Polyline
            key={`dock_line_${item.point.id}`}
            positions={[
              [item.point.latitude, item.point.longitude],
              [anchor.lat, anchor.lng],
            ]}
            pathOptions={{
              color: item.owner?.color || '#38bdf8',
              weight: 2,
              opacity: 0.72,
              dashArray: '6 6',
            }}
          />
        );
      })}
    </>
  );
}

function MapBookmarkCard({
  point,
  owner,
  text,
  onUpdatePoint,
  onUploadPhotos,
  onSetFeatured,
  onClearFeatured,
  onDeletePhoto,
  onDeletePoint,
}) {
  return (
    <div className="map-bookmark-card">
      <div className="map-bookmark-head">
        <h4>{point.place || `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`}</h4>
        <button
          type="button"
          className="glass-button map-danger-btn"
          onClick={() => onDeletePoint(point.id)}
        >
          {text.removePointBtn}
        </button>
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
        onChange={(event) => onUpdatePoint(point.id, { route: event.target.value })}
      />

      <div className="map-bookmark-photo-head">
        <strong>{text.photosTitle}</strong>
        <button
          type="button"
          className="glass-button map-clear-featured-btn"
          onClick={() => onClearFeatured(point.id)}
        >
          {text.clearFeaturedBtn}
        </button>
      </div>

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

      {point.photos.length === 0 && <p className="map-empty-line">{text.noPhotos}</p>}

      {point.photos.length > 0 && (
        <div className="map-photo-grid">
          {point.photos.map((photo) => {
            const isFeatured = photo.id === point.featuredPhotoId;
            return (
              <figure key={photo.id} className={`map-photo-card ${isFeatured ? 'is-featured' : ''}`}>
                <img src={photo.url} alt={photo.name || text.photosTitle} />
                <figcaption title={photo.name}>{photo.name || 'image'}</figcaption>
                <div className="map-photo-actions">
                  <button
                    type="button"
                    className="glass-button"
                    onClick={() => onSetFeatured(point.id, photo.id)}
                  >
                    {isFeatured ? text.featuredBadge : text.setFeaturedBtn}
                  </button>
                  <button
                    type="button"
                    className="glass-button map-danger-btn"
                    onClick={() => onDeletePhoto(point.id, photo.id)}
                  >
                    {text.removePhotoBtn}
                  </button>
                </div>
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MapView({
  activeUserId,
  activeUserName,
  language,
  onBackToSchedule,
}) {
  const text = language === 'zh' ? TEXTS.zh : TEXTS.en;
  const storageKey = useMemo(
    () => (activeUserId ? `nanmuz_map_workspace_${activeUserId}` : null),
    [activeUserId],
  );

  const [scope, setScope] = useState('china');
  const [users, setUsers] = useState([]);
  const [points, setPoints] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isAddUserExpanded, setIsAddUserExpanded] = useState(false);
  const [showFeaturedBubbles, setShowFeaturedBubbles] = useState(true);
  const [bubbleLayout, setBubbleLayout] = useState('map');
  const [selectedPointId, setSelectedPointId] = useState('');

  const [newUserName, setNewUserName] = useState('');
  const [newUserColor, setNewUserColor] = useState(COLOR_PALETTE[0]);
  const [newUserRgb, setNewUserRgb] = useState(hexToRgbString(COLOR_PALETTE[0]));
  const [editUserName, setEditUserName] = useState('');
  const [expandedUserId, setExpandedUserId] = useState('');

  const [cityQuery, setCityQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');

  const [placeInput, setPlaceInput] = useState('');
  const [latitudeInput, setLatitudeInput] = useState('');
  const [longitudeInput, setLongitudeInput] = useState('');
  const [routeInput, setRouteInput] = useState('');
  const [formMessage, setFormMessage] = useState('');

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      const defaultName = activeUserName || (language === 'zh' ? '用户' : 'User');
      const fallbackUser = {
        id: makeId('user'),
        name: defaultName,
        color: COLOR_PALETTE[0],
      };

      let loadedScope = 'china';
      let loadedUsers = [fallbackUser];
      let loadedPoints = [];
      let loadedShowFeaturedBubbles = true;
      let loadedBubbleLayout = 'map';

      if (storageKey) {
        try {
          const fromDb = await readWorkspaceFromDb(storageKey);
          const localBackup = localStorage.getItem(storageKey);
          const parsed = fromDb || (localBackup ? JSON.parse(localBackup) : null);
          if (parsed) {
            loadedScope = parsed?.scope === 'world' ? 'world' : 'china';
            loadedShowFeaturedBubbles = parsed?.showFeaturedBubbles !== false;
            loadedBubbleLayout = ['map', 'right', 'bottom'].includes(parsed?.bubbleLayout)
              ? parsed.bubbleLayout
              : 'map';
            loadedUsers = Array.isArray(parsed?.users) && parsed.users.length
              ? parsed.users.map((user, index) => normalizeUser(user, index, defaultName))
              : [fallbackUser];
            loadedPoints = Array.isArray(parsed?.points)
              ? parsed.points
                  .map((point, index) => normalizePoint(point, index, loadedUsers))
                  .filter(Boolean)
              : [];
          }
        } catch {
          loadedScope = 'china';
          loadedUsers = [fallbackUser];
          loadedPoints = [];
        }
      }

      if (cancelled) {
        return;
      }

      setScope(loadedScope);
      setUsers(loadedUsers);
      setPoints(loadedPoints);
      setShowFeaturedBubbles(loadedShowFeaturedBubbles);
      setBubbleLayout(loadedBubbleLayout);
      setSelectedUserId(loadedUsers[0]?.id || '');
      setExpandedUserId(loadedUsers[0]?.id || '');
      setSelectedPointId('');
      setNewUserColor(COLOR_PALETTE[1]);
      setNewUserRgb(hexToRgbString(COLOR_PALETTE[1]));
      setIsLoaded(true);
    };

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [activeUserName, language, storageKey]);

  useEffect(() => {
    if (!isLoaded || !storageKey) {
      return;
    }

    const payload = {
      scope,
      users,
      points,
      showFeaturedBubbles,
      bubbleLayout,
      savedAt: new Date().toISOString(),
    };

    (async () => {
      try {
        await writeWorkspaceToDb(storageKey, payload);
        localStorage.setItem(storageKey, JSON.stringify({
          scope,
          showFeaturedBubbles,
          bubbleLayout,
          users,
          points: [],
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
  }, [bubbleLayout, isLoaded, points, scope, showFeaturedBubbles, storageKey, text.storageLimitError, users]);

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

  const selectedPoint = useMemo(
    () => points.find((point) => point.id === selectedPointId) || null,
    [points, selectedPointId],
  );
  const selectedPointOwner = selectedPoint ? userMap.get(selectedPoint.userId) : null;

  useEffect(() => {
    setEditUserName(selectedUser?.name || '');
  }, [selectedUser?.id, selectedUser?.name]);

  const handleNewRgbChange = (value) => {
    setNewUserRgb(value);
    const parsed = rgbToHex(value);
    if (parsed) {
      setNewUserColor(parsed);
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

    setUsers((previous) => previous.map((user) => (
      user.id === selectedUser.id
        ? { ...user, name: nextName }
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

    const shouldDelete = window.confirm(
      `${text.deleteUserConfirm} "${selectedUser.name}"\n${text.userDeleteReassign} "${fallbackUser.name}"`,
    );
    if (!shouldDelete) {
      return;
    }

    setPoints((previous) => previous.map((point) => (
      point.userId === selectedUser.id
        ? { ...point, userId: fallbackUser.id }
        : point
    )));
    setUsers((previous) => previous.filter((user) => user.id !== selectedUser.id));
    setSelectedUserId(fallbackUser.id);
    setExpandedUserId(fallbackUser.id);
    setFormMessage('');
  };

  const handleEditPointFromUserList = (pointId) => {
    setSelectedPointId(pointId);
  };

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
    setPlaceInput(result.name);
    setLatitudeInput(result.latitude.toFixed(6));
    setLongitudeInput(result.longitude.toFixed(6));
    setSearchResults([]);
    setSearchMessage('');
    setFormMessage('');
  };

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

    const point = {
      id: makeId('point'),
      userId: selectedUserId,
      place: placeInput.trim(),
      latitude,
      longitude,
      route: routeInput.trim(),
      photos: [],
      featuredPhotoId: null,
      noFeatured: false,
    };

    setPoints((previous) => [...previous, point]);
    setSelectedPointId(point.id);
    setFormMessage('');
    setPlaceInput('');
    setLatitudeInput('');
    setLongitudeInput('');
    setRouteInput('');
    setCityQuery('');
    setSearchResults([]);
  };

  const updatePoint = (pointId, updates) => {
    setPoints((previous) => previous.map((point) => (
      point.id === pointId
        ? { ...point, ...updates }
        : point
    )));
  };

  const deletePoint = (pointId) => {
    setPoints((previous) => previous.filter((point) => point.id !== pointId));
    setSelectedPointId((previous) => (previous === pointId ? '' : previous));
  };

  const uploadPhotos = async (pointId, fileList) => {
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

    try {
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
      const settled = await Promise.allSettled(candidateFiles.map((file) => compressImageFile(file)));
      const photos = settled
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);

      if (!photos.length) {
        setFormMessage(text.photoReadError);
        return;
      }

      setPoints((previous) => previous.map((point) => {
        if (point.id !== pointId) {
          return point;
        }

        const mergedPhotos = [...point.photos, ...photos];
        let featuredPhotoId = point.featuredPhotoId;

        if (!featuredPhotoId && mergedPhotos.length === 1 && !point.noFeatured) {
          featuredPhotoId = mergedPhotos[0].id;
        }

        return {
          ...point,
          photos: mergedPhotos,
          featuredPhotoId,
        };
      }));

      const hasDecodeFailure = settled.some((result) => result.status === 'rejected');
      if (oversizedFiles.length > 0) {
        setFormMessage(text.photoTooLargeError);
      } else if (hasDecodeFailure) {
        setFormMessage(text.photoReadError);
      } else if (allowedFiles.length > restSlots) {
        setFormMessage(text.photoCountLimitError);
      } else {
        setFormMessage('');
      }
    } catch {
      setFormMessage(text.photoReadError);
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

  const deletePhoto = (pointId, photoId) => {
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

  return (
    <section className="glass-panel map-view-root">
      <header className="map-view-header">
        <div>
          <h2>{text.title}</h2>
          <p>{text.subtitle}</p>
        </div>
        <div className="map-view-actions">
          <div className="map-scope-toggle">
            <button
              type="button"
              className={`glass-button map-scope-btn ${scope === 'china' ? 'active' : ''}`}
              onClick={() => setScope('china')}
            >
              {text.chinaScope}
            </button>
            <button
              type="button"
              className={`glass-button map-scope-btn ${scope === 'world' ? 'active' : ''}`}
              onClick={() => setScope('world')}
            >
              {text.worldScope}
            </button>
          </div>

          <button
            type="button"
            className="glass-button map-featured-toggle-btn"
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

          <button type="button" className="glass-button" onClick={onBackToSchedule}>
            {text.backToSchedule}
          </button>
        </div>
      </header>

      <div className="map-view-layout">
        <aside className="map-sidebar">
          <section className="map-panel">
            <h3>{text.legendTitle}</h3>
            <p className="map-muted">{text.legendHint}</p>
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
                          <button
                            type="button"
                            className="glass-button map-danger-btn"
                            onClick={() => deletePoint(point.id)}
                          >
                            {text.placeDeleteBtn}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

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
              <div className="map-user-edit-actions">
                <button
                  type="button"
                  className="glass-button map-user-rename-btn"
                  onClick={handleRenameUser}
                  disabled={!selectedUser}
                >
                  {text.renameUserBtn}
                </button>
                <button
                  type="button"
                  className="glass-button map-danger-btn"
                  onClick={handleDeleteUser}
                  disabled={!selectedUser || users.length <= 1}
                >
                  {text.deleteUserBtn}
                </button>
              </div>
            </div>
          </section>

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

            {searchResults.length > 0 && (
              <div className="map-search-results">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="map-search-result"
                    onClick={() => applySearchResult(result)}
                  >
                    <span>{result.name}</span>
                    <small>{result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}</small>
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

            <button type="button" className="glass-button map-block-btn" onClick={handleAddPoint}>
              {text.addPointBtn}
            </button>
          </section>

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

          {(formMessage || searchMessage) && (
            <div className="map-message-box">
              {formMessage && <p>{formMessage}</p>}
              {searchMessage && <p>{searchMessage}</p>}
            </div>
          )}
        </aside>

        <div className="map-canvas-column">
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
            >
              <MapViewportController scope={scope} />
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
              />

              {showFeaturedBubbles && bubbleLayout !== 'map' && (
                <FeaturedDockLines featuredPoints={featuredPoints} layout={bubbleLayout} />
              )}

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
                          src={featuredPhoto.url}
                          alt={featuredPhoto.name || text.featuredPhotoAlt}
                        />
                      </div>
                    </Tooltip>
                  </Marker>
                );
              })}

              {points.map((point) => {
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

          {showFeaturedBubbles && bubbleLayout !== 'map' && featuredPoints.length > 0 && (
            <div className={`map-featured-dock map-featured-dock-${bubbleLayout}`}>
              {featuredPoints.map(({ point, owner, featuredPhoto }) => {
                const bubbleSize = getPhotoBubbleSize(featuredPhoto);
                return (
                  <button
                    key={`dock_item_${point.id}`}
                    type="button"
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
                        src={featuredPhoto.url}
                        alt={featuredPhoto.name || text.featuredPhotoAlt}
                      />
                    </div>
                    <span className="map-featured-dock-caption">
                      {point.place || `${point.latitude.toFixed(3)}, ${point.longitude.toFixed(3)}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedPoint && (
        <aside className="glass-panel map-bookmark-editor-float">
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
            text={text}
            onUpdatePoint={updatePoint}
            onUploadPhotos={uploadPhotos}
            onSetFeatured={setFeaturedPhoto}
            onClearFeatured={clearFeaturedPhoto}
            onDeletePhoto={deletePhoto}
            onDeletePoint={deletePoint}
          />
        </aside>
      )}
    </section>
  );
}

export default MapView;
