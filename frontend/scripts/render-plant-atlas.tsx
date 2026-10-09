import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { PlantArt } from '../src/components/PlantArt';

const species = [
  ['Cà chua', 'bush', 'round', '#E8503A', '#FFD96B'],
  ['Ớt', 'bush', 'cone', '#E03A2F', '#F4F0DC'],
  ['Đậu leo', 'vine', 'pod', '#7BC96F', '#F7E7B0'],
  ['Cà rốt', 'root', 'root', '#F08A3C', '#F4F0DC'],
  ['Bắp ngô', 'stalk', 'cob', '#F5CC4D', '#E8DFA8'],
  ['Hướng dương', 'head', 'head', '#8A6A3A', '#FFC83D'],
  ['Húng quế', 'leafy', 'none', '#5FA85C', '#E6F0C8'],
] as const;
let content = '<rect width="1050" height="1890" fill="#F8F6EE"/><text x="32" y="42" font-size="24" fill="#294630">Sprouty · Hồ sơ hình dáng cây</text>';
species.forEach(([label, form, fruitShape, fruitColor, flowerColor], row) => {
  content += `<text x="32" y="${88 + row*250}" font-size="18" fill="#294630">${label}</text>`;
  (['seedling', 'flowering', 'mature'] as const).forEach((stage, col) => {
    const svg = renderToStaticMarkup(<PlantArt stage={stage} form={form} fruitShape={fruitShape} fruitColor={fruitColor} flowerColor={flowerColor} progress={50} size={220} />, { identifierPrefix: `p${row}-${col}` });
    content += `<g transform="translate(${260 + col*250} ${60+row*250})">${svg}</g>`;
  });
});
writeFileSync('../docs/plant-atlas.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="1890" font-family="Arial,sans-serif">${content}</svg>`);
console.log('Wrote docs/plant-atlas.svg');
