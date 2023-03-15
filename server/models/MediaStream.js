const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class MediaStream extends Model { }

  MediaStream.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    index: DataTypes.INTEGER,
    codecType: DataTypes.STRING,
    codec: DataTypes.STRING,
    channels: DataTypes.INTEGER,
    channelLayout: DataTypes.STRING,
    bitrate: DataTypes.INTEGER,
    timeBase: DataTypes.STRING,
    duration: DataTypes.FLOAT,
    sampleRate: DataTypes.INTEGER,
    language: DataTypes.STRING,
    default: DataTypes.BOOLEAN,
    // Video stream specific
    profile: DataTypes.STRING,
    width: DataTypes.INTEGER,
    height: DataTypes.INTEGER,
    codedWidth: DataTypes.INTEGER,
    codedHeight: DataTypes.INTEGER,
    pixFmt: DataTypes.STRING,
    level: DataTypes.INTEGER,
    frameRate: DataTypes.FLOAT,
    colorSpace: DataTypes.STRING,
    colorRange: DataTypes.STRING,
    chromaLocation: DataTypes.STRING,
    displayAspectRatio: DataTypes.FLOAT,
    // Chapters JSON
    chapters: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'MediaStream'
  })

  const { MediaFile } = sequelize.models

  MediaFile.hasMany(MediaStream)
  MediaStream.belongsTo(MediaFile)

  return MediaStream
}