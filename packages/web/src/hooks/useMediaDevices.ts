/**
 * useMediaDevices Hook
 *
 * Enumerates available video and audio input devices.
 * Handles device permissions and provides device selection state.
 */

import { useState, useEffect, useCallback } from 'react';

export interface MediaDevice {
  deviceId: string;
  label: string;
  kind: 'videoinput' | 'audioinput';
}

interface UseMediaDevicesReturn {
  videoDevices: MediaDevice[];
  audioDevices: MediaDevice[];
  selectedVideoDevice: string;
  selectedAudioDevice: string;
  setSelectedVideoDevice: (deviceId: string) => void;
  setSelectedAudioDevice: (deviceId: string) => void;
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unknown';
  requestPermissions: () => Promise<boolean>;
  refreshDevices: () => Promise<void>;
}

export function useMediaDevices(): UseMediaDevicesReturn {
  const [videoDevices, setVideoDevices] = useState<MediaDevice[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDevice[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');

  /**
   * Enumerate available media devices
   */
  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const video: MediaDevice[] = [];
      const audio: MediaDevice[] = [];

      devices.forEach((device) => {
        if (device.kind === 'videoinput') {
          video.push({
            deviceId: device.deviceId,
            label: device.label || `Camera ${video.length + 1}`,
            kind: 'videoinput',
          });
        } else if (device.kind === 'audioinput') {
          audio.push({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${audio.length + 1}`,
            kind: 'audioinput',
          });
        }
      });

      setVideoDevices(video);
      setAudioDevices(audio);

      // Set default selections if not already set
      setSelectedVideoDevice((prev) => prev || (video.length > 0 ? video[0].deviceId : ''));
      setSelectedAudioDevice((prev) => prev || (audio.length > 0 ? audio[0].deviceId : ''));

      // Check if we have meaningful labels (indicates permission granted)
      const hasLabels = devices.some((d) => d.label && d.label.length > 0);
      if (hasLabels) {
        setPermissionStatus('granted');
      }
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
    }
  }, []);

  /**
   * Request camera and microphone permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      // Request permissions by getting a temporary stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Immediately stop the tracks - we just needed permission
      stream.getTracks().forEach((track) => track.stop());

      setPermissionStatus('granted');

      // Refresh devices now that we have labels
      await refreshDevices();

      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        setPermissionStatus('denied');
      }
      return false;
    }
  }, [refreshDevices]);

  // Listen for device changes (plug/unplug) and initial enumeration
  useEffect(() => {
    let mounted = true;

    const handleDeviceChange = () => {
      if (mounted) {
        refreshDevices();
      }
    };

    // Initial enumeration - this is a standard pattern for loading external data on mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshDevices();

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      mounted = false;
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [refreshDevices]);

  return {
    videoDevices,
    audioDevices,
    selectedVideoDevice,
    selectedAudioDevice,
    setSelectedVideoDevice,
    setSelectedAudioDevice,
    permissionStatus,
    requestPermissions,
    refreshDevices,
  };
}
