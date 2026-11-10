/**
 * The parts of the HERE Maps API for JavaScript 3.1 this app uses.
 * The SDK is loaded from js.api.here.com at runtime (see lib/here-maps.ts)
 * and exposes a global `H`.
 */
declare namespace H {
  namespace geo {
    interface IPoint {
      lat: number;
      lng: number;
    }
    class Rect {}
  }

  namespace map {
    class Object {}
    class Icon {
      constructor(bitmap: string, options?: { size?: { w: number; h: number } });
    }
    class DomIcon {
      constructor(element: string | Element);
    }
    class Marker extends Object {
      constructor(position: geo.IPoint, options?: { icon?: Icon });
    }
    class DomMarker extends Object {
      constructor(position: geo.IPoint, options?: { icon?: DomIcon });
    }
    class Group extends Object {
      addObjects(objects: Object[]): void;
      getBoundingBox(): geo.Rect | null;
    }
    namespace layer {
      class Layer {}
    }
  }

  namespace service {
    interface DefaultLayers {
      vector: { normal: { map: map.layer.Layer } };
    }
    class Platform {
      constructor(options: { apikey: string });
      createDefaultLayers(): DefaultLayers;
    }
  }

  class Map {
    constructor(
      element: HTMLElement,
      baseLayer: map.layer.Layer,
      options?: { center?: geo.IPoint; zoom?: number; pixelRatio?: number },
    );
    addObject(object: map.Object): void;
    getViewModel(): { setLookAtData(data: { bounds?: geo.Rect }): void };
    getViewPort(): { resize(): void; setPadding(top: number, right: number, bottom: number, left: number): void };
    dispose(): void;
  }

  namespace mapevents {
    class MapEvents {
      constructor(map: Map);
    }
    class Behavior {
      constructor(events: MapEvents);
    }
  }

  namespace ui {
    class UI {
      static createDefault(map: Map, layers: service.DefaultLayers): UI;
    }
  }
}

interface Window {
  H?: typeof H;
}
