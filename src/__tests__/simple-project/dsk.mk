.PHONY: dsk

dsk: $(PROGRAM).dsk

# $(AC) is AppleCommander-ac-x.x.x.jar
# from
# https://github.com/AppleCommander/AppleCommander/releases
# build as
# make TARGETS=apple2 dsk
# or
# make TARGETS=apple2enh dsk

AC := $(HOME)/Downloads/AppleCommander-ac-1.8.0.jar

REMOVES += $(PROGRAM).dsk

$(PROGRAM).dsk: program.apple2 prodos.dsk
	cp prodos.dsk $@.tmp
	java -jar $(AC) -as $@.tmp startup            < $<
	java -jar $(AC) -p  $@.tmp startup.system sys < $(shell cl65 --print-target-path)/$(TARGETS)/util/loader.system
	mv $@.tmp $@