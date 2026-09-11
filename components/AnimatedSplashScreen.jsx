import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const ANIMATION_DURATION_MS = 3000;
const FADE_DURATION_MS = 500;

export default function AnimatedSplashScreen({ onFinish }) {
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const timer = setTimeout(() => {
            Animated.timing(opacity, {
                toValue: 0,
                duration: FADE_DURATION_MS,
                useNativeDriver: true,
            }).start(() => onFinish?.());
        }, ANIMATION_DURATION_MS);

        return () => clearTimeout(timer);
    }, [onFinish, opacity]);

    return (
        <Animated.View style={[styles.container, { opacity }]}>
            <Image
                source={require('../assets/images/splash-mobile.gif')}
                style={styles.image}
                contentFit="cover"
                priority="high"
            />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#4A43EC',
        zIndex: 9999,
    },
    image: {
        width: '100%',
        height: '100%',
    },
});
