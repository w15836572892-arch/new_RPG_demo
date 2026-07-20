# ===== 阶段1：背景重绘 · 新增/修改方法 =====
# 将以下方法替换到 LearningHall.ts 中对应的 drawBackground() 及之后

// ===== 颜色常量（新增到类顶部） =====
private readonly C = {
  SKY_TOP:    new Color(255, 218, 170),  // 浅金橙
  SKY_MID:    new Color(220, 235, 240),  // 淡青白
  SKY_LOW:    new Color(180, 210, 180),  // 天边浅绿
  HORIZON:    new Color(255, 200, 140),  // 地平暖光
  MOUNT_1:    new Color(120, 140, 110, 80),  // 远山最淡
  MOUNT_2:    new Color(100, 120, 90, 100),  // 中远山
  MOUNT_3:    new Color(80, 100, 70, 120),   // 近山
  WALL:       new Color(140, 110, 80, 60),  // 城墙
  GATE:       new Color(120, 90, 60, 80),   // 城门
  TEMPLE:     new Color(100, 80, 55, 70),   // 宗庙顶
  WATER:      new Color(80, 160, 200, 100),  // 洹河水
  WATER_LIT:  new Color(140, 200, 230, 60),  // 水面反光
  GRASS_1:    new Color(98, 148, 73, 180),   // 草皮主色
  GRASS_2:    new Color(78, 128, 58, 160),   // 草皮暗
  GRASS_3:    new Color(118, 168, 88, 140),  // 草皮亮
  PATH:       new Color(170, 130, 85, 180),  // 土路
  PATH_EDGE:  new Color(140, 100, 60, 120),  // 土路边
  FIGURE:     new Color(40, 30, 20, 200),    // 人物剪影
} as const;

// ===== drawBackground() 重写 =====
private drawBackground(root: Node) {
  const visible = view.getVisibleSize();
  const width = visible.width / this.viewportScale;
  const height = visible.height / this.viewportScale;
  const cx = 0;
  const groundY = -height * .18;  // 地平线上移，给草地更多空间

  // 1. 上午暖金天空
  const sky = this.graphics(root, "HallSky", 0, 0, width, height, 0);
  for (let y = -height / 2; y < height / 2; y += 4) {
    const t = (y + height / 2) / height;
    const r = Math.round(255 - 37 * t);
    const g = Math.round(218 - (218 - 225) * t * t);
    const b = Math.round(170 - (170 - 230) * t * t);
    sky.fillColor = new Color(r, g, b, 253);
    sky.rect(-width / 2, y, width, 4); sky.fill();
  }

  // 2. 地平暖光横切
  const glow = this.graphics(root, "HallHorizonGlow", 0, groundY, width, 60, 1);
  glow.fillColor = this.C.HORIZON;
  glow.rect(-width / 2, -30, width, 30); glow.fill();
  for (let x = -width / 2; x < width / 2; x += 30) {
    glow.fillColor = new Color(255, 210, 130, 40);
    glow.circle(x, -10, 3); glow.fill();
  }

  // 3. 远山——洹河北岸山丘 + 城墙 + 宗庙尖顶
  this.drawMountainSilhouette(root, width, groundY);

  // 4. 洹河水带
  this.drawRiverBand(root, width, groundY);

  // 5. 草皮 pixel 纹理
  this.drawPixelGrass(root, width, height, groundY);

  // 6. 弯土路 + 小人物剪影
  this.drawWindingPath(root, width, height, groundY);
}

// ===== 新增辅助方法 =====

private drawMountainSilhouette(root: Node, width: number, groundY: number) {
  const mount = this.graphics(root, "HallMountains", 0, groundY, width, 160, 1);
  // Layer 1: 远处洹河北岸山丘
  mount.fillColor = this.C.MOUNT_1;
  mount.moveTo(-width / 2, 0);
  let pts = [[-width/2,0],[-width/2.5,-50],[-width/3.5,-30],[-width/5,-60],[-width/8,-35],[0,-55],[width/10,-40],[width/5,-50],[width/3,-25],[width/2,0]];
  for (const [x,y] of pts) mount.lineTo(x, y);
  mount.close(); mount.fill();
  // Layer 2: 城墙轮廓
  mount.fillColor = this.C.WALL;
  mount.fillRect(-width/8, -15, width/4, 4);
  mount.fillColor = this.C.GATE;
  mount.fillRect(-12, -22, 24, 10);
  // Layer 3: 宗庙尖顶
  mount.fillColor = this.C.TEMPLE;
  mount.moveTo(-6, -22);
  mount.lineTo(0, -40);
  mount.lineTo(6, -22);
  mount.close(); mount.fill();
  // Layer 4: 近山
  const nearM = this.graphics(root, "HallNearMountain", 0, groundY, width, 120, 1);
  nearM.fillColor = this.C.MOUNT_3;
  nearM.moveTo(-width/2, 0);
  for (const [x,y] of [[-width/2,0],[-width/2.8,-35],[-width/4.5,-20],[-width/6,-40],[-width/12,-25],[width/12,-30],[width/5,-18],[width/3,-28],[width/2,0]])
    nearM.lineTo(x, y);
  nearM.close(); nearM.fill();
}

private drawRiverBand(root: Node, width: number, groundY: number) {
  // 洹河水带在中景位置
  const riverY = groundY - 8;
  const river = this.graphics(root, "HallHuanRiver", 0, riverY, width * .55, 14, 2);
  // 主体水带
  river.fillColor = this.C.WATER;
  river.moveTo(-width * .25, -3);
  river.quadraticCurveTo(-width * .1, -7, width * .05, -2);
  river.quadraticCurveTo(width * .15, 2, width * .28, -1);
  river.lineTo(width * .28, 3);
  river.quadraticCurveTo(width * .15, 6, width * .05, 2);
  river.quadraticCurveTo(-width * .1, 7, -width * .25, 3);
  river.close(); river.fill();
  // 水光
  const lit = this.graphics(root, "HallRiverLit", 0, riverY, width * .4, 6, 2);
  lit.fillColor = this.C.WATER_LIT;
  lit.rect(-width * .15, 0, width * .2, 1); lit.fill();
  for (let x = -width * .18; x < width * .18; x += 20) {
    if (Math.random() > .4) {
      lit.fillColor = new Color(180, 220, 255, 60);
      lit.rect(x, -1, 8, 1); lit.fill();
    }
  }
}

private drawPixelGrass(root: Node, width: number, height: number, groundY: number) {
  const grassH = height / 2 + groundY;  // 草地总高度
  const grass = this.graphics(root, "HallPixelGrass", 0, -height / 2 + grassH / 2, width, grassH, 2);
  // 三层叠压 pixel 色块
  const blockSize = 8;
  for (let layer = 0; layer < 3; layer++) {
    const color = layer === 0 ? this.C.GRASS_3 : layer === 1 ? this.C.GRASS_1 : this.C.GRASS_2;
    grass.fillColor = color;
    for (let x = -width / 2; x < width / 2; x += blockSize) {
      for (let y = -grassH / 2; y < grassH / 2; y += blockSize) {
        if (((x / blockSize + y / blockSize + layer * 3) & 3) === 0) {
          grass.fillRect(x, y, blockSize, blockSize);
        }
      }
    }
  }
}

private drawWindingPath(root: Node, width: number, height: number, groundY: number) {
  const grassH = height / 2 + groundY;
  const pathBottom = -height / 2;
  const pathTop = groundY + 8;
  const pathMid = (pathBottom + pathTop) / 2;
  const path = this.graphics(root, "HallDirtPath", 0, pathMid, 60, pathTop - pathBottom, 3);
  // 弯曲土路
  path.fillColor = this.C.PATH;
  path.moveTo(-10, (pathTop - pathBottom) / 2);
  path.quadraticCurveTo(10, 0, -5, -(pathTop - pathBottom) / 2);
  path.lineTo(10, -(pathTop - pathBottom) / 2);
  path.quadraticCurveTo(25, 0, 5, (pathTop - pathBottom) / 2);
  path.close(); path.fill();
  // 路边
  path.fillColor = this.C.PATH_EDGE;
  path.moveTo(-8, (pathTop - pathBottom) / 2);
  path.quadraticCurveTo(8, -30, -6, -(pathTop - pathBottom) / 2);
  path.lineTo(-4, -(pathTop - pathBottom) / 2);
  path.quadraticCurveTo(10, -30, -6, (pathTop - pathBottom) / 2);
  path.close(); path.fill();
  // 小人物剪影
  const figure = this.graphics(root, "HallFigure", 8, pathBottom + grassH * .35, 16, 24, 3);
  figure.fillColor = this.C.FIGURE;
  figure.circle(0, 4, 4); figure.fill();  // 头
  figure.rect(-3, -4, 6, 8); figure.fill();  // 身
  figure.rect(-1, -10, 2, 4); figure.fill();  // 腿
}

# ===== 阶段1 结束 =====
# 以上方法替换 LearningHall.ts 中的 drawBackground()，
# 并新增 drawMountainSilhouette/drawRiverBand/drawPixelGrass/drawWindingPath
# 和 C 颜色常量