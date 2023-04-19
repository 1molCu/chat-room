import type { Participant } from 'livekit-client';
import { LocalAudioTrack, RemoteAudioTrack, Track } from 'livekit-client';
import * as React from 'react';
import { useMediaTrack } from '@livekit/components-react'
import { createAudioAnalyser} from '@/lib/client-utils'
import { useObservableState } from '@/lib/livekit-react-offical/hooks/internal';
import { denoiseMethod$ } from '@/lib/observe/DenoiseMethodObs';
import { defaultAudioSetting } from '@/lib/const';
export interface AudioVisualizerProps extends React.HTMLAttributes<SVGElement> {
  participant?: Participant;
}

export function AudioVisualizer({ participant, ...props }: AudioVisualizerProps) {
  const [volumeBars, setVolumeBars] = React.useState<Array<number>>([]);

  const svgWidth = 200;
  const svgHeight = 90;
  const barWidth = 6;
  const barSpacing = 4;
  const volMultiplier = 50;
  const barCount = 7;

  const { track } = useMediaTrack(Track.Source.Microphone, participant);
  // add cwy 查看当前选择的降噪方法是否为join
  const denoiseMethod = useObservableState(denoiseMethod$, {...defaultAudioSetting.denoiseMethod});

  React.useEffect(() => {
    debugger
    if (!track || !(track instanceof LocalAudioTrack || track instanceof RemoteAudioTrack)) {
      return;
    }
    const { analyser, cleanup } = createAudioAnalyser(track, denoiseMethod, {
      smoothingTimeConstant: 0.8,
      fftSize: 64,
    });

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const calculateBars = () => {
      analyser.getByteFrequencyData(dataArray);
      const sums: Array<number> = new Array(barCount).fill(0);
      dataArray.slice(1);
      const binSize = 6;

      for (let i = 0; i < barCount / 2; i += 1) {
        const id = Math.floor(barCount / 2 - i);
        for (let k = 0; k < binSize; k += 1) {
          sums[id] += Math.pow(dataArray[i * binSize + k] / 255, 2);
        }
        sums[id] /= binSize;
      }
      for (let i = 0; i < barCount / 2; i += 1) {
        const id = Math.floor(barCount / 2 + i);
        if (sums[id] !== 0) {
          continue;
        }
        for (let k = 0; k < binSize; k += 1) {
          sums[id] += Math.pow(dataArray[i * binSize + k] / 255, 2);
        }
        sums[id] /= binSize;
      }
      return sums.map((s) => s * volMultiplier);
    };

    const calcInterval = setInterval(() => {
      const bars = calculateBars();
      setVolumeBars(bars);
    }, 100);

    return () => {
      clearInterval(calcInterval);
      cleanup();
    };
    // add by cwy
    // offical version has a bug, need to add `track?.mediaStream` to the dependency array
  }, [track, track?.mediaStream, denoiseMethod]);

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      {...props}
      className="lk-audio-visualizer"
    >
      <rect x="0" y="0" width="100%" height="100%" />
      <g
        style={{
          transform: `translate(${(svgWidth - barCount * (barWidth + barSpacing)) / 2}px, 0)`,
        }}
      >
        {volumeBars.map((vol, idx) => (
          <rect
            key={idx}
            x={idx * (barWidth + barSpacing)}
            y={svgHeight / 2 - vol / 2}
            width={barWidth}
            height={vol}
          ></rect>
        ))}
      </g>
    </svg>
  );
}
