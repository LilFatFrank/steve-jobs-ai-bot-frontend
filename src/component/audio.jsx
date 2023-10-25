import React, { useState, useEffect } from "react";
import hark from "hark";

const ContinuousAudioRecorder = () => {
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speechEvents, setSpeechEvents] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isloading, setIsLoading] = useState(false);

  const sendAudioToBackend = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.wav");
      setIsLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/xi/transcribe`, {
        method: "POST",
        body: formData,
      });
      setIsLoading(false);
      if (!response.ok) {
        throw new Error(`Network response was not ok ${response.statusText}`);
      }
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      setIsPlaying(true);
      source.start();
      source.onended = () => {
        setIsPlaying(false);
      };

      // TODO: Handle the backend response as needed
    } catch (error) {
      console.error("Error sending audio data: ", error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = handleDataAvailable;
      setMediaRecorder(recorder);

      recorder.start(); // Remove timeslice parameter

      const options = { threshold: -50 };
      const speechEvents = hark(stream, options);
      setSpeechEvents(speechEvents);
      speechEvents.on("speaking", () => {
        if (isPlaying || isloading) return;
        console.log("User is speaking");
        if (recorder.state === "inactive") {
          recorder.start(); // Start a new recording session when user starts speaking
        }
      });
      speechEvents.on("stopped_speaking", () => {
        if (isPlaying || isloading) return;
        console.log("User stopped speaking");
        if (recorder.state === "recording") {
          recorder.stop(); // Stop recording when user stops speaking
        }
      });

      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording: ", error);
    }
  };

  const handleDataAvailable = (event) => {
    if (event.data.size > 0) {
      const audioBlob = new Blob([event.data], { type: "audio/wav" });
      console.log(audioBlob);
      sendAudioToBackend(audioBlob);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
    if (speechEvents) {
      speechEvents.stop();
    }
    setIsRecording(false);
  };

  useEffect(() => {
    return () => stopRecording();
  }, []);

  return (
    <div>
      <button onClick={startRecording} disabled={isRecording}>
        Call Steve
      </button>
      <button onClick={stopRecording} disabled={!isRecording}>
        End call
      </button>
      {isloading ? <p>steve is thinking of a response</p> : null}
    </div>
  );
};

export default ContinuousAudioRecorder;
