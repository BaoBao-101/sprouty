/**
 * Where each leaf sits on the trunk artwork, as percentages of the stage, plus
 * the SVG mask that gives it a leaf silhouette.
 */
export interface LeafPosition {
  file: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export const LEAF_POSITIONS = [
  { file:"leaf-01.png", left:24.19, top:65.95, width:15.17, height:12.48 },
  { file:"leaf-02.png", left:55.97, top:61.31, width:16.13, height:11.36 },
  { file:"leaf-03.png", left:11.94, top:66.85, width:12.54, height:6.14 },
  { file:"leaf-04.png", left:65.54, top:58.85, width:15.46, height:6.85 },
  { file:"leaf-05.png", left:14.88, top:59.14, width:15.55, height:6.78 },
  { file:"leaf-06.png", left:22.30, top:52.13, width:18.56, height:8.96 },
  { file:"leaf-07.png", left:56.99, top:50.08, width:17.76, height:9.57 },
  { file:"leaf-08.png", left:75.68, top:51.68, width:11.52, height:10.91 },
  { file:"leaf-09.png", left:36.22, top:35.87, width:11.33, height:16.10 },
  { file:"leaf-10.png", left:11.94, top:48.22, width:11.97, height:10.43 },
  { file:"leaf-11.png", left:84.74, top:52.93, width:11.01, height:7.68 },
  { file:"leaf-12.png", left:3.46, top:47.74, width:12.54, height:6.14 },
  { file:"leaf-13.png", left:67.87, top:38.59, width:19.33, height:8.29 },
  { file:"leaf-14.png", left:80.16, top:45.25, width:15.62, height:6.72 },
  { file:"leaf-15.png", left:54.85, top:26.14, width:9.34, height:18.11 },
  { file:"leaf-16.png", left:16.16, top:32.74, width:15.55, height:11.97 },
  { file:"leaf-17.png", left:5.79, top:39.84, width:15.55, height:6.78 },
  { file:"leaf-18.png", left:34.34, top:26.98, width:11.42, height:7.30 },
  { file:"leaf-19.png", left:26.56, top:22.66, width:6.98, height:15.20 },
  { file:"leaf-20.png", left:80.93, top:30.11, width:15.55, height:6.78 },
  { file:"leaf-21.png", left:72.86, top:20.22, width:13.73, height:14.05 },
  { file:"leaf-22.png", left:30.14, top:15.07, width:13.18, height:8.99 },
  { file:"leaf-23.png", left:50.82, top:8.38, width:9.47, height:17.95 },
  { file:"leaf-24.png", left:60.32, top:13.44, width:8.70, height:10.18 },
  { file:"leaf-25.png", left:70.75, top:11.07, width:6.94, height:15.36 },
  { file:"leaf-26.png", left:43.39, top:3.10, width:7.30, height:14.85 },
  { file:"leaf-27.png", left:22.82, top:8.70, width:13.02, height:5.82 },
  { file:"leaf-28.png", left:32.83, top:1.54, width:10.05, height:12.29 },
];
