import React from 'react';

export default function VisionUploader({ media, setForm }) {
  const handleMediaUpload = (e) => {
    const files = Array.from(e.target.files);
    setForm((prev) => ({ ...prev, media: [...prev.media, ...files] }));
  };

  const removeFile = (index) => {
    setForm((prev) => ({
      ...prev,
      media: prev.media.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="border border-blue-400 p-4 rounded-lg bg-blue-50 dark:bg-gray-800 dark:border-blue-700">
      <label className="block text-sm font-semibold mb-1 text-blue-800 dark:text-blue-300">
        📸 Upload Evidence (Powered by AI Vision Engine)
      </label>
      <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
        Images uploaded here will be automatically verified for authenticity, categorized, and scored for severity.
      </p>
      
      <input
        type="file"
        multiple
        onChange={handleMediaUpload}
        className="w-full border rounded px-3 py-2 bg-white focus:outline-none focus:ring focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
      />
      {media.length > 0 && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {media.map((file, index) => (
            <div key={index} className="relative border-2 border-dashed border-gray-300 rounded p-1">
              {file.type.startsWith("image") ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt="preview"
                  className="w-full h-24 object-cover rounded"
                />
              ) : file.type.startsWith("video") ? (
                <video
                  src={URL.createObjectURL(file)}
                  className="w-full h-24 object-cover rounded"
                  controls
                />
              ) : (
                <div className="flex items-center justify-center h-24 text-xs text-center p-1 text-gray-700 dark:text-gray-200">
                  {file.name}
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow-md"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
