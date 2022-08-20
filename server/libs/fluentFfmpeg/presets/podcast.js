/*jshint node:true */
'use strict';

exports.load = function(ffmpeg) {
  ffmpeg
    .format('m4v')
    .videoBitrate('512k')
    .videoCodec('libx264')
    .size('320x176')
    .audioBitrate('128k')
    .audioCodec('aac')
    .audioChannels(1)
    .outputOptions(['-flags', '+loop', '-cmp', '+chroma', '-partitions','+parti4x4+partp8x8+partb8x8', '-flags2',
      '+mixed_refs', '-me_method umh', '-subq 5', '-bufsize 2M', '-rc_eq \'blurCplx^(1-qComp)\'',
      '-qcomp 0.6', '-qmin 10', '-qmax 51', '-qdiff 4', '-level 13' ]);
};
