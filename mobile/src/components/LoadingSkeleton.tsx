import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface LoadingSkeletonProps {
  type: 'card' | 'list' | 'stats';
  count?: number;
}

export default function LoadingSkeleton({ type, count = 4 }: LoadingSkeletonProps) {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.25,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const skeletonColor = colors.border;
  const pulseStyle = { opacity: pulseAnim };

  // 1. STATS SKELETON (DASHBOARD METRICS)
  if (type === 'stats') {
    return (
      <View className="flex gap-4">
        {/* Hero Revenue Card Skeleton */}
        <View 
          className="p-6 rounded-[32px] border"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <Animated.View 
            style={[pulseStyle, { backgroundColor: skeletonColor }]} 
            className="w-48 h-3 rounded-full mb-3"
          />
          <Animated.View 
            style={[pulseStyle, { backgroundColor: skeletonColor }]} 
            className="w-64 h-8 rounded-2xl mb-4"
          />
          <View className="border-t border-slate-800/60 pt-4 flex-row justify-between">
            <Animated.View 
              style={[pulseStyle, { backgroundColor: skeletonColor }]} 
              className="w-32 h-2.5 rounded-full"
            />
            <Animated.View 
              style={[pulseStyle, { backgroundColor: skeletonColor }]} 
              className="w-16 h-2.5 rounded-full"
            />
          </View>
        </View>

        {/* 3-Column Metrics Grid Skeleton */}
        <View className="flex-row gap-3">
          {[1, 2, 3].map((i) => (
            <View 
              key={i} 
              className="flex-1 p-4 rounded-2xl border items-center justify-center"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              <Animated.View 
                style={[pulseStyle, { backgroundColor: skeletonColor }]} 
                className="w-8 h-8 rounded-lg mb-3"
              />
              <Animated.View 
                style={[pulseStyle, { backgroundColor: skeletonColor }]} 
                className="w-10 h-2 rounded-full mb-2"
              />
              <Animated.View 
                style={[pulseStyle, { backgroundColor: skeletonColor }]} 
                className="w-12 h-3.5 rounded-lg"
              />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // 2. CARD SKELETON (POS PRODUCT GRID)
  if (type === 'card') {
    return (
      <View className="flex-row flex-wrap p-2">
        {Array.from({ length: count }).map((_, idx) => (
          <View 
            key={idx} 
            className="w-[45%] m-2 p-3 rounded-[24px] border flex-1"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            {/* Image Placeholder */}
            <View 
              className="w-full aspect-square rounded-2xl mb-3 overflow-hidden items-center justify-center"
              style={{ backgroundColor: colors.bg }}
            >
              <Animated.View 
                style={[pulseStyle, { backgroundColor: skeletonColor }]} 
                className="w-full h-full"
              />
            </View>
            
            {/* Category */}
            <Animated.View 
              style={[pulseStyle, { backgroundColor: skeletonColor }]} 
              className="w-12 h-2.5 rounded-full mb-2"
            />
            
            {/* Title */}
            <Animated.View 
              style={[pulseStyle, { backgroundColor: skeletonColor }]} 
              className="w-24 h-3.5 rounded-full mb-1"
            />
            <Animated.View 
              style={[pulseStyle, { backgroundColor: skeletonColor }]} 
              className="w-16 h-3.5 rounded-full mb-3"
            />
            
            {/* Price & Add row */}
            <View className="flex-row justify-between items-center pt-2 border-t border-slate-800/30">
              <Animated.View 
                style={[pulseStyle, { backgroundColor: skeletonColor }]} 
                className="w-16 h-3 rounded-full"
              />
              <Animated.View 
                style={[pulseStyle, { backgroundColor: skeletonColor }]} 
                className="w-7 h-7 rounded-xl"
              />
            </View>
          </View>
        ))}
      </View>
    );
  }

  // 3. LIST SKELETON (ORDERS / PRODUCTS LIST)
  return (
    <View className="flex gap-4 p-4">
      {Array.from({ length: count }).map((_, idx) => (
        <View 
          key={idx} 
          className="flex-row items-center p-4 rounded-[28px] border"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          {/* Circular avatar placeholder */}
          <View 
            className="w-14 h-14 rounded-2xl items-center justify-center overflow-hidden"
            style={{ backgroundColor: colors.bg }}
          >
            <Animated.View 
              style={[pulseStyle, { backgroundColor: skeletonColor }]} 
              className="w-full h-full"
            />
          </View>
          
          {/* Text placeholders */}
          <View className="flex-1 ml-4 flex gap-2">
            <Animated.View 
              style={[pulseStyle, { backgroundColor: skeletonColor }]} 
              className="w-32 h-3.5 rounded-full"
            />
            <Animated.View 
              style={[pulseStyle, { backgroundColor: skeletonColor }]} 
              className="w-48 h-2.5 rounded-full"
            />
            <Animated.View 
              style={[pulseStyle, { backgroundColor: skeletonColor }]} 
              className="w-24 h-3 rounded-full"
            />
          </View>
          
          {/* Action icon placeholder */}
          <Animated.View 
            style={[pulseStyle, { backgroundColor: skeletonColor }]} 
            className="w-8 h-8 rounded-xl"
          />
        </View>
      ))}
    </View>
  );
}
