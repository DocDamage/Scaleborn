import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';
import { FORMS } from '../src/actors/dragon/forms';
import { mountedRiderSeat } from '../src/actors/rider/mountSeat';
import { riderPose } from '../src/actors/rider/pose';
import { beginTraversal } from '../src/actors/dragon/traversalTransition';

describe('hybrid rider arm and leg contact animation', () => {
  it('reaches forward and bends the knees down the dragon flank in every mounted form', () => {
    const state = newFlightState(), dragon = new DragonVisual();
    try {
      for (const form of ['rideable', 'giant'] as const) {
        state.form = form;
        state.mode = 'air';
        state.time += 1.5;
        state.roll = .3;
        dragon.update(state);
        const pose = riderPose(state);
        const leftArm = dragon.rider.getObjectByName('rider.leftArm') as THREE.Group;
        const leftElbow = dragon.rider.getObjectByName('rider.leftElbow') as THREE.Group;
        const leftKnee = dragon.rider.getObjectByName('rider.leftKnee') as THREE.Group;
        const rightKnee = dragon.rider.getObjectByName('rider.rightKnee') as THREE.Group;
        expect(pose.leftArm).toBeGreaterThan(.4);
        expect(pose.leftElbow).toBeGreaterThan(.2);
        if(form==='giant'){
          expect(pose.leftKnee).toBeGreaterThan(.25);
          expect(pose.legSpread).toBeLessThan(.3);
        }else{
          expect(pose.leftKnee).toBeLessThan(-.8);
          expect(pose.legSpread).toBeGreaterThan(.85);
        }
        expect(pose.leftKnee).not.toBe(pose.rightKnee);
        expect(leftArm.rotation.x).toBeCloseTo(pose.leftArm, 6);
        expect(leftElbow.rotation.x).toBeCloseTo(pose.leftElbow, 6);
        expect(leftKnee.rotation.x).toBeCloseTo(pose.leftKnee, 6);
        expect(rightKnee.rotation.x).toBeCloseTo(pose.rightKnee, 6);
        expect(leftArm).toBeInstanceOf(THREE.Group);
        expect(dragon.rider.getObjectByName('rider.leftLeg')!.rotation.z)
          .toBeCloseTo(-pose.legSpread,6);
        expect(leftKnee.rotation.z).toBeCloseTo(-pose.kneeSpread,6);
        expect(dragon.rider.scale.x).toBe(1);
        const seat=mountedRiderSeat(dragon.body.scale.x);
        expect(dragon.rider.position.y).toBeCloseTo(seat.y, 6);
        expect(dragon.body.scale.x).toBeLessThanOrEqual(FORMS.giant.visualScale);
      }
    } finally { dragon.dispose(); }
  });

  it('restores straight legs on foot and produces bounded walking joints', () => {
    const state = newFlightState(), dragon = new DragonVisual();
    try {
      state.form='small';
      state.mode='ground';
      state.riderMode='ground';
      state.riderSpeed=0;
      state.time=1;
      dragon.update(state);
      const leftKnee=dragon.rider.getObjectByName('rider.leftKnee') as THREE.Group;
      const leftAnkle=dragon.rider.getObjectByName('rider.leftAnkle') as THREE.Group;
      expect(leftKnee.rotation.x).toBe(0);
      expect(leftAnkle.rotation.x).toBeCloseTo(0,6);
      expect(dragon.rider.getObjectByName('rider.leftLeg')!.rotation.z).toBeCloseTo(0,6);
      state.riderSpeed=3;state.time=1.4;dragon.update(state);
      expect(leftKnee.rotation.x).toBeGreaterThanOrEqual(0);
      expect(Math.abs(leftAnkle.rotation.x)).toBeLessThan(.25);
      const motion=riderPose(state);
      expect(Object.values(motion).filter(v=>typeof v==='number')
        .every(Number.isFinite)).toBe(true);
    } finally { dragon.dispose(); }
  });

  it('adds restrained and finite launch/landing bracing', () => {
    const state = newFlightState();
    const neutral=riderPose(state);
    beginTraversal(state,'takingOff',state.y+8,state.speed);
    const launch=riderPose(state);
    expect(launch.leftElbow).toBeGreaterThan(neutral.leftElbow);
    state.transition=null;
    beginTraversal(state,'landing',state.y-8,state.speed);
    const landing=riderPose(state);
    expect(landing.leftArm).toBeGreaterThan(neutral.leftArm);
    expect(landing.leftKnee).toBeLessThan(-.8);
  });
});
