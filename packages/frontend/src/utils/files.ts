export const downloadText = (fileName: string, content: string): void => {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/octet-stream" }),
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
};
