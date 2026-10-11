// Album formats use a canonical MIME/extension and still verify container bytes.
const ascii = (b, start, end) => b.subarray(start, end).toString('ascii');
const bmff = (b) => ascii(b, 4, 8) === 'ftyp';
const ebml = (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
export const ALBUM_FORMATS = [
  ['image/jpeg', ['jpg', 'jpeg', 'jfif'], (b) => b[0] === 255 && b[1] === 216 && b[2] === 255],
  ['image/png', ['png'], (b) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))],
  ['image/webp', ['webp'], (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP'],
  ['image/gif', ['gif'], (b) => ['GIF87a', 'GIF89a'].includes(ascii(b, 0, 6))],
  ['image/bmp', ['bmp'], (b) => ascii(b, 0, 2) === 'BM'],
  ['image/tiff', ['tif', 'tiff'], (b) => ['49492a00', '4d4d002a'].includes(b.subarray(0, 4).toString('hex'))],
  ['image/avif', ['avif'], (b) => bmff(b) && ['avif', 'avis'].includes(ascii(b, 8, 12))],
  ['image/heic', ['heic', 'heif', 'hif'], (b) => bmff(b) && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(ascii(b, 8, 12))],
  ['video/mp4', ['mp4', 'm4v'], bmff],
  ['video/quicktime', ['mov', 'qt'], (b) => ['ftyp', 'moov', 'mdat', 'wide', 'free'].includes(ascii(b, 4, 8))],
  ['video/webm', ['webm'], ebml],
  ['video/x-matroska', ['mkv'], ebml],
  ['video/x-msvideo', ['avi'], (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'AVI '],
  ['video/3gpp', ['3gp', '3gpp'], bmff],
  ['video/3gpp2', ['3g2'], bmff],
  ['video/mpeg', ['mpeg', 'mpg', 'mpe'], (b) => ['000001ba', '000001b3'].includes(b.subarray(0, 4).toString('hex'))],
  ['video/ogg', ['ogv'], (b) => ascii(b, 0, 4) === 'OggS'],
  ['video/x-ms-wmv', ['wmv', 'asf'], (b) => b.subarray(0, 16).toString('hex') === '3026b2758e66cf11a6d900aa0062ce6c'],
  ['video/x-flv', ['flv'], (b) => ascii(b, 0, 3) === 'FLV'],
];

export function albumFormat(filename = '', mimeType = '') {
  const extension = filename.split('.').pop().toLowerCase();
  return ALBUM_FORMATS.find(([, extensions]) => extensions.includes(extension))
    || ALBUM_FORMATS.find(([mime]) => mime === mimeType.toLowerCase().split(';')[0].trim());
}
