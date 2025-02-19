import * as THREE from 'three';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

export class RubiksCube extends THREE.Object3D {
  private readonly evaluator: Evaluator;
  private readonly raycaster: THREE.Raycaster;
  private readonly boundingBox: THREE.Mesh;
  private mouse: THREE.Vector2;
  private isDragging: boolean = false;
  private dragStart: { x: number | null; y: number | null } = {
    x: null,
    y: null,
  };
  private initialIntersect: THREE.Intersection | null = null;
  private selectedFace: 'x' | 'y' | 'z' | null = null;
  private rotationAxis: 'x' | 'y' | 'z' | null = null;
  private rotationSection: 0 | 1 | 2 | null = null;
  private rotationAngle: number | null = null;
  private isRotating: boolean = false;

  constructor(
    private readonly camera: THREE.Camera,
    options: {
      evaluator?: Evaluator;
      raycaster?: THREE.Raycaster;
      colors?: [
        THREE.ColorRepresentation,
        THREE.ColorRepresentation,
        THREE.ColorRepresentation,
        THREE.ColorRepresentation,
        THREE.ColorRepresentation,
        THREE.ColorRepresentation,
      ];
      borderColor?: THREE.ColorRepresentation;
    } = {},
  ) {
    super();
    const { evaluator, raycaster, colors, borderColor } = options;
    this.evaluator = evaluator ? evaluator : new Evaluator();
    this.raycaster = raycaster ? raycaster : new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.initCube({ colors, borderColor });
    this.boundingBox = this.createBoundingBox();
  }

  private initCube({
    colors,
    borderColor,
  }: {
    colors?: [
      THREE.ColorRepresentation,
      THREE.ColorRepresentation,
      THREE.ColorRepresentation,
      THREE.ColorRepresentation,
      THREE.ColorRepresentation,
      THREE.ColorRepresentation,
    ];
    borderColor?: THREE.ColorRepresentation;
  }): void {
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const piece = new RubiksPiece({
            evaluator: this.evaluator,
            colors,
            borderColor,
          });
          piece.position.set(x * piece.size, y * piece.size, z * piece.size);
          this.add(piece);
        }
      }
    }

    this.initEventListeners();
  }

  private createBoundingBox() {
    const size = 3; // Size of the Rubik's Cube
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      opacity: 0,
      transparent: true,
    });
    const boundingBox = new THREE.Mesh(geometry, material);
    // this.add(boundingBox);
    return boundingBox;
  }

  private initEventListeners() {
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    window.addEventListener('keydown', this.onKeyboardRotation.bind(this));
  }

  onMouseDown(event: MouseEvent) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects([this.boundingBox]);

    if (intersects.length > 0) {
      this.initialIntersect = intersects[0];
      this.isDragging = true;
      this.dragStart.x = event.clientX;
      this.dragStart.y = event.clientY;
    }
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isDragging || !this.initialIntersect) return;

    const { x: startX, y: startY } = this.dragStart;
    if (startX === null || startY === null) return;

    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;

    if (Math.abs(deltaX) < 10 || Math.abs(deltaY) < 10) return;

    const { x, y, z } = this.initialIntersect.normal ?? {};

    if (
      this.rotationAxis !== null &&
      this.rotationSection !== null &&
      this.rotationAngle !== null
    ) {
      this.setRotation(this.rotationAxis, this.rotationSection, deltaX, deltaY);
      return;
    }

    this.rotationAngle = 0;

    if (x !== 0) {
      this.rotationAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'y' : 'z';
      this.selectedFace = 'x';
    }

    if (y !== 0) {
      this.rotationAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'z' : 'x';
      this.selectedFace = 'y';
    }

    if (z !== 0) {
      this.rotationAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'y' : 'x';
      this.selectedFace = 'z';
    }

    if (this.rotationAxis) {
      this.rotationSection = this.getSection(
        this.initialIntersect.point[this.rotationAxis],
      );
    }
  }

  onMouseUp(_event: MouseEvent) {
    this.isDragging = false;

    if (
      this.rotationAxis &&
      this.rotationSection !== null &&
      this.rotationAngle !== null
    ) {
      const angleClamp = nearestClampDistance(this.rotationAngle);
      this.applyRotation(this.rotationAxis, this.rotationSection, angleClamp);
    }

    this.rotationAxis = null;
    this.rotationSection = null;
    this.rotationAngle = null;
  }

  private onKeyboardRotation(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.rotateCube('x', 'clockwise');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.rotateCube('x', 'counterclockwise');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.rotateCube('y', 'clockwise');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.rotateCube('y', 'counterclockwise');
        break;
    }
  }

  public rotateCube(
    axis: 'x' | 'y',
    direction: 'clockwise' | 'counterclockwise',
    duration: number = 500,
  ): void {
    if (this.isRotating) return;
    this.isRotating = true;
    const targetAngle = direction === 'clockwise' ? Math.PI / 2 : -Math.PI / 2;

    this.animateCubeRotation(axis, targetAngle, duration);
  }

  private animateCubeRotation(
    axis: 'x' | 'y',
    targetAngle: number,
    duration: number,
  ): void {
    const clock = new THREE.Clock();
    const startTime = clock.getElapsedTime();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime() - startTime;
      const progress = Math.min(elapsedTime / (duration / 1000), 1);
      const easedProgress = easeInOutCubic(progress);
      const currentAngle = targetAngle * easedProgress;

      this.rotateEntireCube(axis, currentAngle - (this.rotationAngle || 0));
      this.rotationAngle = currentAngle;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isRotating = false;
        this.rotationAngle = null;
      }
    };

    requestAnimationFrame(animate);
  }

  private rotateEntireCube(axis: 'x' | 'y' | 'z', angle: number): void {
    const pivot = new THREE.Object3D();
    const center = new THREE.Vector3();

    // Calculate the center of the Rubik's Cube
    const boundingBox = new THREE.Box3().setFromObject(this);
    boundingBox.getCenter(center);

    pivot.position.copy(center);
    this.add(pivot);

    // Apply rotation using the pivot
    this.rotateCubesAroundPivot(
      pivot,
      this.children as THREE.Object3D[],
      axis,
      angle,
    );
  }

  private getSection(position: number): 0 | 1 | 2 {
    if (position < -0.5) return 0;
    if (position > 0.5) return 2;
    return 1;
  }

  private setRotation(
    axis: 'x' | 'y' | 'z',
    section: 0 | 1 | 2,
    deltaX: number,
    deltaY: number,
  ): void {
    if (this.rotationAngle === null) {
      throw new Error(
        'Rotation cannot be set without rotation angle being set.',
      );
    }

    const angle = this.getRotationAngle(deltaX, deltaY);

    const remainingRotation = angle - this.rotationAngle;

    this.applyRotation(axis, section, remainingRotation);
    this.rotationAngle = angle;
  }

  private getRotationAngle(deltaX: number, deltaY: number) {
    if (this.selectedFace === this.rotationAxis) {
      throw new Error(
        `The selected face and rotation axis should not be the same. Both were ${this.selectedFace} [${this.selectedFace}, ${this.rotationAxis}].`,
      );
    }

    let maxpoint: number | null = null;
    let startingPoint: number | null = null;
    let delta: number | null = null;

    const isXAxis = this.selectedFace === 'x';
    const isYAxis = this.selectedFace === 'y';
    const isZAxis = this.selectedFace === 'z';

    const hasXRotationAxis = this.rotationAxis === 'x';
    const hasYRotationAxis = this.rotationAxis === 'y';
    const hasZRotationAxis = this.rotationAxis === 'z';

    if (
      (isXAxis && hasYRotationAxis) ||
      (isYAxis && hasZRotationAxis) ||
      (isZAxis && hasYRotationAxis)
    ) {
      maxpoint = window.innerWidth;
      startingPoint = this.dragStart.x;
      delta = isYAxis ? -deltaX : deltaX;
    }

    if (
      (isXAxis && hasZRotationAxis) ||
      (isYAxis && hasXRotationAxis) ||
      (isZAxis && hasXRotationAxis)
    ) {
      maxpoint = window.innerHeight;
      startingPoint = this.dragStart.y;
      delta = deltaY;
    }

    if (!delta || !maxpoint || !startingPoint) {
      throw new Error(
        'Unable to determine angle. Please check the selected face and rotation axis to make sure they are a valid combination of x, y, and z.',
      );
    }

    const maxDelta = delta > 0 ? maxpoint - startingPoint : startingPoint;
    const angle = ((delta / maxDelta) * Math.PI) / 2;
    // Clamp the angle to -90 and 90 degrees to prevent over-rotation.
    return Math.min(Math.max(angle, -Math.PI / 2), Math.PI / 2);
  }

  private applyRotation(
    axis: 'x' | 'y' | 'z',
    section: 0 | 1 | 2,
    angle: number,
  ): void {
    const cubes = this.getSectionCubes(axis, section);
    if (cubes.length === 0) return;

    const center = this.calculateGroupCenter(cubes);
    const pivot = this.createPivot(center);
    this.rotateCubesAroundPivot(pivot, cubes, axis, angle);
  }

  private getSectionCubes(
    axis: 'x' | 'y' | 'z',
    section: 0 | 1 | 2,
  ): THREE.Object3D[] {
    const cubes: THREE.Object3D[] = [];
    this.children.forEach((child) => {
      if (this.isInSection(child.position, axis, section)) {
        cubes.push(child);
      }
    });
    return cubes;
  }

  private calculateGroupCenter(cubes: THREE.Object3D[]) {
    const boundingBox = new THREE.Box3();
    cubes.forEach((cube) => {
      boundingBox.expandByObject(cube);
    });
    return boundingBox.getCenter(new THREE.Vector3());
  }

  private createPivot(center: THREE.Vector3): THREE.Object3D {
    const pivot = new THREE.Object3D();
    pivot.position.copy(center);
    this.add(pivot);
    return pivot;
  }

  private rotateCubesAroundPivot(
    pivot: THREE.Object3D,
    cubes: THREE.Object3D[],
    axis: 'x' | 'y' | 'z',
    angle: number,
  ): void {
    const rotationAxis = new THREE.Vector3();
    rotationAxis[axis] = 1;

    cubes.forEach((cube) => {
      cube.position.sub(pivot.position);
      cube.applyMatrix4(
        new THREE.Matrix4().makeRotationAxis(rotationAxis, angle),
      );
      cube.position.add(pivot.position);
    });

    this.remove(pivot);
  }

  private isInSection(
    position: THREE.Vector3,
    axis: 'x' | 'y' | 'z',
    section: 0 | 1 | 2,
  ): boolean {
    const value = position[axis];
    if (section === 0) return value < -0.5;
    if (section === 1) return value >= -0.5 && value <= 0.5;
    return value > 0.5;
  }

  public rotate(
    axis: 'x' | 'y' | 'z',
    section: 0 | 1 | 2,
    direction: 'clockwise' | 'counterclockwise',
    duration: number = 500,
    callback?: () => void,
  ): void {
    const targetAngle = direction === 'clockwise' ? Math.PI / 2 : -Math.PI / 2;
    this.animateSectionRotation(axis, section, targetAngle, duration, callback);
  }

  private animateSectionRotation(
    axis: 'x' | 'y' | 'z',
    section: 0 | 1 | 2,
    targetAngle: number,
    duration: number,
    callback?: () => void,
  ): void {
    const clock = new THREE.Clock();
    const startTime = clock.getElapsedTime();
    const initialAngle = 0; // Starting from 0 for simplicity

    const animate = () => {
      const elapsedTime = clock.getElapsedTime() - startTime;
      const progress = Math.min(elapsedTime / (duration / 1000), 1);
      const easedProgress = easeInOutCubic(progress);
      const currentAngle = initialAngle + targetAngle * easedProgress;

      this.applyRotation(
        axis,
        section,
        currentAngle - (this.rotationAngle ?? 0),
      );
      this.rotationAngle = currentAngle;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isRotating = false;
        this.rotationAngle = null;
        callback && callback(); // Call the callback function if provided
      }
    };

    requestAnimationFrame(animate);
  }

  public shuffle(turns: number = 25): void {
    const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
    const sections: (0 | 1 | 2)[] = [0, 1, 2];
    const directions: ('clockwise' | 'counterclockwise')[] = [
      'clockwise',
      'counterclockwise',
    ];

    const shuffleTurn = (currentTurn: number) => {
      if (currentTurn < turns) {
        const axis = axes[Math.floor(Math.random() * axes.length)];
        const section = sections[Math.floor(Math.random() * sections.length)];
        const direction =
          directions[Math.floor(Math.random() * directions.length)];

        this.rotate(axis, section, direction, 500, () => {
          shuffleTurn(currentTurn + 1);
        });
      }
    };

    shuffleTurn(0);
  }
}

class RubiksPiece extends THREE.Mesh {
  constructor(
    private readonly options: {
      evaluator?: Evaluator;
      size?: number;
      borderSize?: number;
      borderColor?: THREE.ColorRepresentation;
      colors?: [
        THREE.ColorRepresentation,
        THREE.ColorRepresentation,
        THREE.ColorRepresentation,
        THREE.ColorRepresentation,
        THREE.ColorRepresentation,
        THREE.ColorRepresentation,
      ];
    } = {},
  ) {
    const {
      evaluator = new Evaluator(),
      size = 1,
      borderSize = 0.1,
      colors = [0xffffff, 0xffff00, 0x0000ff, 0x00ff00, 0xff0000, 0xffa500],
      borderColor,
    } = options;
    const border = new Brush(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshBasicMaterial({ color: borderColor }),
    );

    const holeXGeometry = new THREE.BoxGeometry(
      size,
      size - borderSize,
      size - borderSize,
    );
    const holeX = new Brush(holeXGeometry);

    const holeYGeometry = new THREE.BoxGeometry(
      size - borderSize,
      size,
      size - borderSize,
    );
    const holeY = new Brush(holeYGeometry);

    const holeZGeometry = new THREE.BoxGeometry(
      size - borderSize,
      size - borderSize,
      size,
    );
    const holeZ = new Brush(holeZGeometry);

    let block = evaluator.evaluate(border, holeZ, SUBTRACTION);
    block = evaluator.evaluate(block, holeX, SUBTRACTION);
    block = evaluator.evaluate(block, holeY, SUBTRACTION);
    block.geometry.clearGroups();
    block.material = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.5,
      metalness: 0.0,
    });

    const fillGeometry = new THREE.BoxGeometry(
      size - borderSize,
      size - borderSize,
      size - borderSize,
    );

    const faceColors = [
      { color: colors[0], position: new THREE.Vector3(0, 0, borderSize / 2) },
      { color: colors[1], position: new THREE.Vector3(0, 0, -borderSize / 2) },
      { color: colors[2], position: new THREE.Vector3(-borderSize / 2, 0, 0) },
      { color: colors[3], position: new THREE.Vector3(borderSize / 2, 0, 0) },
      { color: colors[4], position: new THREE.Vector3(0, borderSize / 2, 0) },
      { color: colors[5], position: new THREE.Vector3(0, -borderSize / 2, 0) },
    ];

    faceColors.forEach((face) => {
      const faceBrush = new Brush(
        fillGeometry,
        new THREE.MeshStandardMaterial({
          color: face.color,
          roughness: 0.5,
          metalness: 0,
        }),
      );
      faceBrush.position.copy(face.position);
      faceBrush.updateMatrixWorld();
      block = evaluator.evaluate(block, faceBrush, ADDITION);
    });

    super(block.geometry, block.material);
  }

  get size(): number {
    return this.options.size ?? 1;
  }

  get borderSize(): number {
    return this.options.borderSize ?? 0.1;
  }
}

function nearestClampDistance(
  angle: number,
  clamps = [-Math.PI / 2, 0, Math.PI / 2],
) {
  let nearest = clamps[0];
  let minDistance = Math.abs(angle - clamps[0]);

  for (let i = 1; i < clamps.length; i++) {
    const distance = Math.abs(angle - clamps[i]);
    if (distance < minDistance) {
      nearest = clamps[i];
      minDistance = distance;
    }
  }

  return nearest - angle;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
