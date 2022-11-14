.PHONY: dsk

dsk: $(PROGRAM).dsk

REMOVES += $(PROGRAM).dsk

$(OBJDIR)/AppleCommander.jar:
	curl -L https://github.com/AppleCommander/AppleCommander/releases/download/1.8.0/AppleCommander-ac-1.8.0.jar > "$@"

$(PROGRAM).dsk: $(PROGRAM) prodos.dsk $(OBJDIR)/AppleCommander.jar
	cp prodos.dsk "$@.tmp"
	java -jar $(OBJDIR)/AppleCommander.jar -as "$@.tmp" startup            < "$<"
	java -jar $(OBJDIR)/AppleCommander.jar -p "$@.tmp" startup.system sys < "$(shell cl65 --print-target-path)/$(TARGETS)/util/loader.system"
	mv "$@.tmp" "$@"
