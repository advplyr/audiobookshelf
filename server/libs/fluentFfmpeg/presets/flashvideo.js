/*jshint node:true */
'use strict';

exports.load = function(ffmpeg) {
  ffmpeg
    .format('flv')
    .flvmeta()
    .size('320x?')
    .videoBitrate('512k')
    .videoCodec('libx264')
    .fps(24)
    .audioBitrate('96k')
    .audioCodec('aac')
    .audioFrequency(22050)
    .audioChannels(2);
};
