import { useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
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
  center: [35.8617, 104.1954],
  zoom: 4,
  minZoom: 3,
};

const WORLD_VIEW = {
  center: [20, 0],
  zoom: 2,
  minZoom: 2,
};

const TEXTS = {
  en: {
    title: 'Map Workspace',
    subtitle: 'Manage people, pin locations, and keep route/photo bookmarks.',
    chinaScope: 'China',
    worldScope: 'World',
    backToSchedule: 'Back to schedule',
    legendTitle: 'User Legend',
    legendHint: 'Pick the active user before adding a point.',
    addUserTitle: 'Add User',
    addUserName: 'Username',
    addUserNamePlaceholder: 'e.g. Alice',
    colorHexLabel: 'Color block',
    colorRgbLabel: 'RGB',
    addUserBtn: 'Add user',
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
    featuredBadge: 'Featured',
    removePhotoBtn: 'Remove',
    removePointBtn: 'Remove point',
    photoReadError: 'Some images could not be loaded.',
    geocodeError: 'Failed to search city. Try another keyword or enter coordinates manually.',
    noGeocodeResult: 'No city result found.',
    needUserName: 'Please enter a username first.',
    duplicateUserName: 'This username already exists.',
    invalidRgb: 'RGB must be in the format like 255, 120, 0.',
    needUserSelect: 'Please create/select a user first.',
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
    legendTitle: '用户图例',
    legendHint: '先选择当前用户，再添加地点。',
    addUserTitle: '添加用户',
    addUserName: '用户名',
    addUserNamePlaceholder: '例如：小李',
    colorHexLabel: '色块选择',
    colorRgbLabel: 'RGB',
    addUserBtn: '添加用户',
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
    featuredBadge: '精选',
    removePhotoBtn: '删除',
    removePointBtn: '删除点位',
    photoReadError: '部分图片读取失败，请重试。',
    geocodeError: '城市搜索失败，请换关键词或直接输入经纬度。',
    noGeocodeResult: '没有匹配到城市结果。',
    needUserName: '请先输入用户名。',
    duplicateUserName: '该用户名已存在。',
    invalidRgb: 'RGB 格式应类似 255, 120, 0。',
    needUserSelect: '请先创建或选择用户。',
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

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
  reader.onerror = () => reject(new Error('Failed to read file'));
  reader.readAsDataURL(file);
});

function MapViewportController({ scope }) {
  const map = useMap();

  useEffect(() => {
    if (scope === 'china') {
      map.setMinZoom(CHINA_VIEW.minZoom);
      map.flyTo(CHINA_VIEW.center, CHINA_VIEW.zoom, { duration: 0.75 });
      return;
    }

    map.setMinZoom(WORLD_VIEW.minZoom);
    map.flyTo(WORLD_VIEW.center, WORLD_VIEW.zoom, { duration: 0.75 });
  }, [map, scope]);

  return null;
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

  const [newUserName, setNewUserName] = useState('');
  const [newUserColor, setNewUserColor] = useState(COLOR_PALETTE[0]);
  const [newUserRgb, setNewUserRgb] = useState(hexToRgbString(COLOR_PALETTE[0]));

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
    const defaultName = activeUserName || (language === 'zh' ? '用户' : 'User');
    const fallbackUser = {
      id: makeId('user'),
      name: defaultName,
      color: COLOR_PALETTE[0],
    };

    let loadedScope = 'china';
    let loadedUsers = [fallbackUser];
    let loadedPoints = [];

    if (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          loadedScope = parsed?.scope === 'world' ? 'world' : 'china';
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

    setScope(loadedScope);
    setUsers(loadedUsers);
    setPoints(loadedPoints);
    setSelectedUserId(loadedUsers[0]?.id || '');
    setNewUserColor(COLOR_PALETTE[1]);
    setNewUserRgb(hexToRgbString(COLOR_PALETTE[1]));
    setIsLoaded(true);
  }, [activeUserName, language, storageKey]);

  useEffect(() => {
    if (!isLoaded || !storageKey) {
      return;
    }

    const payload = {
      scope,
      users,
      points,
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [isLoaded, scope, users, points, storageKey]);

  useEffect(() => {
    if (!users.length) {
      setSelectedUserId('');
      return;
    }

    if (!users.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

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
    setNewUserName('');

    const nextColor = COLOR_PALETTE[(users.length + 1) % COLOR_PALETTE.length];
    setNewUserColor(nextColor);
    setNewUserRgb(hexToRgbString(nextColor));
    setFormMessage('');
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
  };

  const uploadPhotos = async (pointId, fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) {
      return;
    }

    try {
      const photos = await Promise.all(files.map(async (file) => ({
        id: makeId('photo'),
        name: file.name,
        url: await readFileAsDataUrl(file),
      })));

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
      setFormMessage('');
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
                return (
                  <li
                    key={user.id}
                    className={`map-user-item ${selectedUserId === user.id ? 'active' : ''}`}
                    onClick={() => setSelectedUserId(user.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedUserId(user.id);
                      }
                    }}
                  >
                    <span className="map-user-dot" style={{ backgroundColor: user.color }} />
                    <span className="map-user-name">{user.name}</span>
                    <span className="map-user-count">{markerCount} {text.userPointsLabel}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="map-panel">
            <h3>{text.addUserTitle}</h3>
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
                    <li key={point.id}>
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
            minZoom={scope === 'china' ? CHINA_VIEW.minZoom : WORLD_VIEW.minZoom}
          >
            <MapViewportController scope={scope} />
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />

            {points.map((point) => {
              const owner = userMap.get(point.userId);
              const markerColor = owner?.color || '#64748b';

              return (
                <CircleMarker
                  key={point.id}
                  center={[point.latitude, point.longitude]}
                  radius={10}
                  pathOptions={{
                    color: markerColor,
                    fillColor: markerColor,
                    fillOpacity: 0.9,
                    weight: 3,
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
                  <Popup minWidth={320} maxWidth={360}>
                    <MapBookmarkCard
                      point={point}
                      owner={owner}
                      text={text}
                      onUpdatePoint={updatePoint}
                      onUploadPhotos={uploadPhotos}
                      onSetFeatured={setFeaturedPhoto}
                      onClearFeatured={clearFeaturedPhoto}
                      onDeletePhoto={deletePhoto}
                      onDeletePoint={deletePoint}
                    />
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </section>
  );
}

export default MapView;
