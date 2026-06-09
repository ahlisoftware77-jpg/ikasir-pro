import React, { useRef } from 'react';
import { View, Animated, PanResponder, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface SwipeableItemProps {
  children: React.ReactNode;
  rightActions: React.ReactNode;
  actionWidth: number;
}

export default function SwipeableItem({ children, rightActions, actionWidth }: SwipeableItemProps) {
  const pan = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2;
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        let newX = isOpen.current ? -actionWidth + gestureState.dx : gestureState.dx;
        
        // Limit swipe to the left
        if (newX > 0) newX = 0;
        // Limit swipe slightly past the actionWidth for a "rubber band" effect
        if (newX < -actionWidth - 20) newX = -actionWidth - 20;

        pan.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        // Threshold to determine if it should snap open or close
        if (gestureState.dx < -40 || (isOpen.current && gestureState.dx < 40)) {
          // Snap open
          Animated.spring(pan, {
            toValue: -actionWidth,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20
          }).start();
          isOpen.current = true;
        } else {
          // Snap closed
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20
          }).start();
          isOpen.current = false;
        }
      },
      // When a tap happens, if it's open, close it (handled by wrapper usually, but good practice)
    })
  ).current;

  return (
    <View style={styles.container}>
      <View style={[styles.actionsContainer, { width: actionWidth }]}>
        {rightActions}
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.swipeableContent, { transform: [{ translateX: pan }] }]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionsContainer: {
    position: 'absolute',
    right: 0,
    height: '100%',
    flexDirection: 'row',
  },
  swipeableContent: {
    backgroundColor: 'transparent',
    width: '100%',
  },
});
