// 预设模板配置
export interface TemplateItem {
  id: string;
  name: string;
  thumbnail: string;
  fullImage: string;
}

/**
 * 从配置文件加载模板列表
 *
 * 使用方法：
 * 1. 把模板图片放到 public/templates/ 文件夹
 * 2. 在 public/templates/config.json 里添加文件名
 *
 * 例如：["卡通微课.png", "蓝色教育.png"]
 */
export async function loadTemplates(): Promise<TemplateItem[]> {
  try {
    const response = await fetch('/templates/config.json');
    const fileNames: string[] = await response.json();

    return fileNames.map(fileName => {
      const nameWithoutExt = fileName.replace(/\.(png|jpg|jpeg|webp)$/i, '');
      return {
        id: nameWithoutExt,
        name: nameWithoutExt,
        thumbnail: `/templates/${fileName}`,
        fullImage: `/templates/${fileName}`,
      };
    });
  } catch (error) {
    console.error('Failed to load templates:', error);
    return [];
  }
}
